import {
    Sequelize,
    ModelDefined,
    DataTypes,
    Optional
} from 'sequelize';

export interface UserAttributes {
    id: number;
    name: string;
    balance: number;
}

type CreateUserAttributes = Optional<UserAttributes, 'id'>;

type UserDef = ModelDefined<UserAttributes, CreateUserAttributes>;

// userId, payout
export interface BetAttributes {
    id: number;
    UserId: number;
    betAmount: number;
    chance: number;
    payout: number;
    win: boolean;
}

type CreateBetAttributes = Optional<BetAttributes, 'id'>;

type BetDef = ModelDefined<BetAttributes, CreateBetAttributes>;

function initializeModel(sequelize: Sequelize) {

    const Bet: ModelDefined<BetAttributes, CreateBetAttributes> =
        sequelize.define('Bet',
            {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                /*was trying to force the column to be "userId" 
                  instead of "UserId", ( although it worked on the db 
                  including correct foreign key constraint)
                  somehow internally it is still working
                  "UserId" (not the initCAP)
                  
                userId: {
                    type: DataTypes.INTEGER,
                    field: 'userId',
                    allowNull: false,
                },*/
                betAmount: {
                    type: DataTypes.FLOAT,
                    allowNull: false,
                    validate: {
                        largerThenZero(value: string) {
                            if (parseInt(value, 10) <= 0) {
                                throw new Error(`${value} is not larger then 0`);
                            }
                        }
                    }
                },
                chance: {
                    type: DataTypes.FLOAT,
                    allowNull: false,
                    validate: {
                        clampedBetweenZeroAndOne(value: string) {
                            const v = parseFloat(value);
                            if (v <= 0 || v >= 1) {
                                throw new Error(`${value} -> (${v}) should be in the range (0,1)`);
                            }
                        }
                    }
                },
                payout: {
                    type: DataTypes.FLOAT,
                    allowNull: false,
                    validate: {
                        min: 0,
                    }
                },
                win: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false
                }
            },
            {
                tableName: 'bets',
                schema: 'betting_game',
                indexes: [{
                    // composite index will speed up the "getBestBetPerUser" query
                    name: 'bets_idx_payout',
                    using: 'BTREE',
                    fields: [
                        {
                            name: 'UserId',
                        },
                        {
                            name: 'payout',
                            order: 'DESC'
                        }
                    ]
                }]
            }
        );

    const User: ModelDefined<UserAttributes, CreateUserAttributes> =
        sequelize.define('User',
            {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true
                },
                name: {
                    type: new DataTypes.STRING(128),
                    allowNull: false,
                },
                balance: {
                    type: DataTypes.FLOAT,
                    allowNull: false,
                    validate: {
                        min: 0
                    }
                },
            },
            {
                tableName: 'users',
                schema: 'betting_game'
            }
        );



    User.hasMany(Bet, {
        foreignKey: {
            //  can force the column on the DB side to be "userId"
            //  but somehow keeps working internally with "UserId"(initCap)
            //    name:'userId',
            //    field: 'userId',
            allowNull: false
        },
        as: 'bets',
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT'
    });

    Bet.belongsTo(User);
    return { User, Bet };
}

async function seedDB(User: UserDef) {
    const rowCount = await User.count();
    if (rowCount !== 0) {
        console.log('[users] table is not empty, skip seeding');
        return;
    }

    await User.create({ name: 'Adam', balance: 8941 });
    await User.create({ name: 'Victor', balance: 4424 });
    await User.create({ name: 'Melanie', balance: 2334 });
    await User.create({ name: 'Piers', balance: 7654 });
    await User.create({ name: 'Richard', balance: 5447 });
    await User.create({ name: 'Ryan', balance: 7803 });
    await User.create({ name: 'Frank', balance: 7424 });
    await User.create({ name: 'Andrea', balance: 5269 });
    await User.create({ name: 'Nicola', balance: 7860 });
    await User.create({ name: 'Alan', balance: 1744 });
}

async function init(): Promise<{ User: UserDef, Bet: BetDef }> {
    const pg_port = process.env.PG_PORT;
    const pg_host = process.env.PG_HOST;
    
    const pg_url = `postgres://betting_game:betting_game@${pg_host}:${pg_port}/ancient_games`;
    
    const sequelize = new Sequelize(pg_url, { logging: console.log });

    // test the connection before we do anything

    await sequelize.authenticate();
    await sequelize.createSchema('betting_game', {});
    const { User, Bet } = initializeModel(sequelize);
    await sequelize.sync()
    await seedDB(User);
    return { User, Bet };
}

export { init };
export type { UserDef, BetDef };

