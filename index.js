
const express = require('express');
const app = express();
const port = process.env.PORT || 3000; 

const agent = require('./agent.js')
app.use(express.static('public'));

// parse body jon
app.use(express.json());

app.post('/api/agent', async (req, res) => { 
  let goal = req.body.goal;
  console.log(req.body);
  let agentID = btoa(new Date().getTime() * Math.random() + " ").substring(0, 8);
  res.json({
    agentID : agentID
  });
  await agent.start(goal, agentID);
});


app.post('/api/agent/:agentId/:taskId', async (req, res) => { 
  let answer = req.body.answer;
  console.log(req.body);
  let agentId = req.params.agentId;
  let taskId = req.params.taskId;
  res.json({});
  await agent.continue(answer, agentId, taskId);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
}
);

