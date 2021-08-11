# betting-game

Betting game mvp

## configuration

This demo runs a dockerized postgresql db

Both postgresql aswell as the betting app use the contents of the `.env` file

```bash
# contents of .env
PG_PORT=6666      #mapped external port of the dockerized postgresql 
PG_HOST=localhost  #external host of the dockerized postgresql
GRAPHQL_PORT=4040  # graphql listen port, navigate to http://localhost:4040/
```

## run the demo

In a seperate shell start the dockerized postgresql

```bash
# run in project root
docker-compose up
```

run the graphql server

```bash
npm install
npm run start
```
