
# WIP

An agent / framework to build agent supporting custom tool in JS. Include :

- An agent live 'chat' to monitor your agent or give more instructions
- Some tool for web browsing (based on zen Browser), and Google search (using google custom search engine API)
- Ability for the agent to plan task
- Ability for the agent to store data to a key value / store or a file
- Ability for the agent to fork itself and interact as the human with the fork agent. Allowing to tackle more complex task

## Setup
1. change the `example.env` to `.env` and add your API keys
2. run `npm install`
3. from root directory run `node index.js`
4. Got to http://localhost:3000 
4b. send a goal to `POST /api/agent`
```
# body
{
  goal:""
}
```
