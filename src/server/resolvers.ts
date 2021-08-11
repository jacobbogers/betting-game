import type { ApolloServerExpressConfig } from 'apollo-server-express';
import { QueryTypes, Transaction } from 'sequelize';

import { UserAttributes, BetAttributes } from './models';
import type { UserDef, BetDef } from './models';

import { bestBetPerUser } from './rawSQL';

type ApolloContext = {
    UserTable: UserDef
    BetTable: BetDef
}

type Resolvers = Pick<ApolloServerExpressConfig, 'resolvers'>;

export const resolvers: Resolvers = {
    resolvers: {
        Mutation: {
            async createBet(root, args: { userId: number, betAmount: number, chance: number }, { BetTable, UserTable }: ApolloContext) {
                const { userId , betAmount , chance } = args;
                if (betAmount <= 0) {
                    // throwing an error could be a security issue
                    // throw new Error('betAmount is zero or negative');
                    console.error(`ERR: illegal bet for user=${userId} betAmount is zero or negative`);
                    return null;
                }
                if (chance <= 0 || chance >= 1) {
                    // throwing an error could be a security issue
                    // throw new Error('bet chance should be between in the range [0, 1]');
                    console.error(`ERR: illegal bet for user=${userId} chance is not clamped at (0,1)`);
                    return null;
                }
                const sequelize = BetTable.sequelize;
                if (!sequelize){
                    console.error('ERR: sequelize not available');
                    return null;
                }
                // start transaction, and isolation levels
                const t = await sequelize.transaction({
                        autocommit: false,
                    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
                });
                //fetch user and check if the balance >= betAmount
                try {
                    const user = await UserTable.findByPk(userId, { transaction: t }) as unknown as UserAttributes;
                    if (!user){
                        console.error(`ERR: illegal bet, non existent user=${userId}`);
                        await t.rollback();
                        return null;
                    }
                    if (user.balance < betAmount){
                        console.error(`ERR: user ${userId} has insufficient credits ${user.balance} < ${betAmount}`);
                        await t.rollback();
                        return null;
                    }
                    // determine payout
                    // long term earnings of the house
                    // p = original chance "house loses" or "player wins"
                    // (1) betAmount*(chance house wins) - (chance house loses)*payout > 0
                    // (2) payout < betAmount(chance house wins)/(chance house loses)
                    // (3) break even if payout = betAmount*(1-p)/p, 
                    // (4) factor (1-p)/p is now (1-p*(1-HOUSE_EDGE))/p

                    const HOUSE_EDGE = 0.15;
                    const multiplication = (1-chance)/chance * (1 - HOUSE_EDGE);
                    const payout = parseFloat((betAmount*multiplication).toFixed(2))

                    // roll the dice
                    const playerWins = Math.random() < chance;

                    const newBalance = parseFloat(
                        (playerWins ? user.balance + payout : user.balance - betAmount).toFixed(2)
                    );

                    await UserTable.update({ balance: newBalance }, {
                         where: {
                            id: userId
                         },
                         transaction: t
                    });
                    const newBet = await BetTable.create({
                               UserId:userId,
                               betAmount: betAmount,
                               chance,
                               payout,
                               win: playerWins
                           }, { transaction: t}) as unknown as BetAttributes;
                    await t.commit();
                    return {
                        id: newBet.id,
                        userId: newBet.UserId,
                        betAmount: newBet.betAmount,
                        chance: newBet.chance,
                        payout: newBet.payout,
                        win: newBet.win
                    };      
                }
                catch(err){
                   await t.rollback();
                   console.error(`Transaction rolled back:${String(err)}`);                        
                   return null;
                }
            }
        },
        Query: {
            async getUser(root, args: { id: number }, { UserTable }: ApolloContext) {
                const { id } = args;
                return UserTable.findByPk(id) as unknown as UserAttributes;
            },
            async getUserList(root, args, { UserTable }: ApolloContext) {
                return UserTable.findAll() as unknown as UserAttributes[];
            },
            async getBet(root, args: { id: number }, { BetTable }: ApolloContext) {
                const { id } = args;
                const record = await BetTable.findByPk(id) as unknown as BetAttributes;
                if (record) {
                    // could not rename UserId to "userId" in sequelize, (yes tried "foreignKey")
                    // in the database correct column and foreign key constraint are created but sequelize keeps
                    // working with "UserId" internally instead of "userId"
                    return {
                        id: record.id,
                        userId: record.UserId,
                        betAmount: record.betAmount,
                        chance: record.chance,
                        payout: record.payout,
                        win: record.win
                    };
                }
                return null;
            },
            async getBestBetPerUser(root, args: { limit?: number }, { BetTable }: ApolloContext) {
                const { limit } = args;
                // either not specified or incorrect value
                if (typeof limit !== 'number' || limit <= 0) {
                    return null;
                }
                //Avoid use of "group by"
                const sql = ` ${bestBetPerUser} ${limit ? ` limit ${limit}` : ''};`.replace(/[\s]{2,}/g,' ');
                console.log(sql);
                const records = await BetTable.sequelize?.query(sql, {
                    type: QueryTypes.SELECT
                }) as (BetAttributes & { createdAt?: Date, updatedAt?: Date, UserId: number })[];
                if (records === null || records === undefined || !Array.isArray(records)) {
                    return null;
                }
                // could not rename UserId to "userId" in sequelize, (yes tried "foreignKey")
                // in the database correct column and foreign key constraint are created but sequelize keeps
                // working with "UserId" internally instead of "userId"
                return records.map(record => {
                    return {
                        id: record.id,
                        userId: record.UserId,
                        betAmount: record.betAmount,
                        chance: record.chance,
                        payout: record.payout,
                        win: record.win
                    };
                });
            }
        }
    }
};