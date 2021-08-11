//vendor
import { ApolloServer } from 'apollo-server';
import type { ApolloServerExpressConfig } from 'apollo-server-express'; // installed with apollo-server

import * as dotenv from 'dotenv';

//this-app

import { init as initDB } from './models';
import { typeDefs } from './typeDefs';
import { resolvers } from './resolvers';

dotenv.config();

(async function startServer() {
    const { User: UserTable, Bet: BetTable } = await initDB();
    console.log('database up');

    const config: ApolloServerExpressConfig = {
        typeDefs,
        ...resolvers,
        context: { UserTable, BetTable }
    };

    const server = new ApolloServer(config);

    return server.listen(process.env.GRAPHQL_PORT).then(({ url }) => {
        console.log(`🚀 Server ready at ${url}`);
    });
})();
