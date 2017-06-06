# slack-mafia
Slackbot that runs mafia games

## Requirements
requires docker and docker-compose

## Running instructions
`docker-compose up --build`

## Bootstrapping
### Adding db user
`docker-compose run app node ./bin/bootstrap_user.js`

### Adding database
`docker-compose run app node ./bin/bootstrap_database.js`

### Coming Soon
Fixtures
