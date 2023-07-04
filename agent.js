

const fs = require('fs');

const { Configuration, OpenAIApi } = require("openai");

const search = require('./tools/googleSearch');
search.configure(process.env.GOOLE_API_KEY, "3359060177f7e45c6");

const browse = require('./tools/browse');


const configuration = new Configuration({
  apiKey: process.env.OPEN_AI_KEY,
});
const openai = new OpenAIApi(configuration);

const logStack = [];
async function logIt(data, id) { 
  logStack.push(data);
  fs.writeFileSync(`${__dirname}/public/trace/log-${id}.json`, JSON.stringify(logStack, null, 2));
}

let tools = [search, browse]


let ID = 0

let STORE = {

}

let MESSAGES = {
  
}

async function agent(goal, agentID) {
  let taskId = ++ID;
  console.log(`New Task (#${taskId}): ${goal}`);

  await logIt({
    type: "NEW_TASK",
    taskId : taskId,
    goal : goal
  }, agentID);

  return think(taskId, goal, agentID);

}



async function think(taskId, goal, agentID) {
  let systemPrompt = `The user will give you a task.
To achieve this goal you can do the following actions by outputing instructions as new lines:`

for (let tool of tools) { 
  systemPrompt += tool.instruction + '\n';
}

systemPrompt += 
`
::PLAN <task> Plan to do a task in the future
::ASK <task>  ask yourself to do a subtask and get the return value. The task should be a string with all information necessary to complete it, do not include references to context explicit it.
::END_RESULT <result>  output the result of the task once it is successfully completed
::ASK_CLARIFICATION <question> ask for context if the task is not clear or missing some context
::CLARIFY <taskId> <answer> provide some context to a clarification request
::STORE <key> <value> store a value in memory
::RETRIEVE <key> retrieve a value from memory

Parameter do not need to be quoted, even if they contain spaces. parameters do not support new lines
Instuction should be at the start of a line.
You should select only one instruction.

When given a task it is good to start by trying to determine how it should be solved and what step should be taken. Do not list your step in a numeric list, just output one step per line.

Once a task is complete it is good to check if the task was completed successfully.

If the task was not completed successfully it is good to try to determine why it was not completed successfully and to retry it.

You can only output one instruction. do not output multiple instructions.

when the task is successfull output the result as csv, unless prompted otherwise.

You have limited attention, try to create subtask to do the task and do them one by one instead of trying to do the whole task at once.

You have limited memory, try to store information in memory to use it later, or to retrieve by other instead of communicating it directly.

If the task is too big, use ASK to split it in subtask and do them one by one.
If you think the task miss context information, you can output ::ASK_CLARIFICATION missing context to do task <details> and the user will give you more information.`;

  // we backup the prompt
  if (!MESSAGES[taskId]) {
    MESSAGES[taskId] = [{"role": "user", "content": goal}];
  }
  else {
    MESSAGES[taskId].push({"role": "user", "content": goal});
  }
  let stack = MESSAGES[taskId];

  while (true) {
    console.log("GPT 4:", JSON.stringify(stack, null, 2));

    let answer = await(prompt([{"role": "system", "content": systemPrompt}, ...stack]));
    
    stack.push({"role": "assistant", "content": answer});
    logIt({ 
      type: "REASONING",
      taskId: taskId,
      answer: answer
    }, agentID);
    console.log("Reasoning:", answer);
    // parse instructions!
    const lines = answer.split('\n');
    for (let line of lines) {
      if (line.startsWith('::')) {
        const instruction = line.split(' ')[0].substring(2);
        let args = line.split(' ').slice(1).join(' ');
        if (args[0] == '"' && args[args.length - 1] == '"') { 
          args = args.substring(1, args.length - 1);
        }

        // handle tools
        for (let tool of tools) { 
          if (instruction === tool.keyword) {
            const res = await tool.do(args);
            logIt({ 
              type: tool.keyword,
              taskId: taskId,
              query: args,
              result: res
            }, agentID);
            stack.push({"role": "user", "content": `Result for ${tool.keyword} with ${args} : ${res}`});
          }
        }

        if (instruction === 'STORE') {
          console.log(`STORE ${args} in memory`)
          let key = args.split(' ')[0];
          let value = args.split(' ').slice(1).join(' ');
          STORE[key] = value;
          logIt({ 
            type: "STORE",
            taskId: taskId,
            key: key,
            value: value
          }, agentID);
          fs.writeFileSync('store.json', JSON.stringify(STORE, null, 2));
        }
        if (instruction === 'RETRIEVE') { 
          console.log(`RETRIEVE ${args} from memory`)
          let key = args.split(' ')[0];
          let value = STORE[key];
          logIt({ 
            type: "RETRIEVE",
            taskId: taskId,
            key: key,
            value: value
          }, agentID);
          stack.push({"role": "user", "content": `RETRIEVE result for ${args} : ${value}`});
        }


        if (instruction === 'ASK') {
          const res = await agent(args, agentID);
          logIt({ 
            type: "ASK",
            taskId: taskId,
            url: args,
            result: res
          }, agentID);
          if (res.type == 'end') {
            stack.push({"role": "user", "content": `I did ${args}. The results are: ${res}`});
          }
          else if (res.type == 'missingContext') {
            stack.push({"role": "user", "content": `I'm missing context to do ${args}: ${res}. To ask me to continue this task, use the clarify instruction with id ${res.taskId}`});
          }
        }
     
        if (instruction === 'END_RESULT') {
          logIt({ 
            type: "END_RESULT",
            taskId: taskId,
            goal: goal,
            args: args
          }, agentID);
          console.log(`Task #${taskId} completed successfully (${goal})with results:
  ${args}`);
          return {
            type: 'end',
            data : args,
            taskId: taskId
          };
        }
        if (instruction === 'ASK_CLARIFICATION') {
          logIt({ 
            type: "ASK_CLARIFICATION",
            taskId: taskId,
            args: args
          }, agentID);
          console.log(`Task #${taskId} ask clarification:
  ${args}`);
          return {
            type: 'missingContext',
            data : args,
            taskId: taskId
          };
        }
        if (instruction === 'CLARIFY') {
          logIt({ 
            type: "CLARIFY",
            taskId: taskId,
            args: args
          }, agentID);
          let asktaskId = args.split(' ')[0];
          let clarification = args.split(' ').slice(1).join(' ');

          const res = await think(asktaskId, clarification, agentID);
         
          if (res.type == 'end') {
            stack.push({"role": "user", "content": `I did ${args}. The results are: ${res}`});
          }
          else if (res.type == 'missingContext') {
            stack.push({"role": "user", "content": `I'm missing context to do ${args}: ${res}. To ask me to continue this task, use the clarify instruction with id ${res.taskId}`});
          }
          
        }
        
      }
    }
  }
  

}


async function prompt(messages) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages:messages,
      max_tokens: 2000,
    });
    return response.data.choices[0].message.content;
  }
  catch (e) {
    // sleep 
    console.log("OPEN AI JAM, wait 10 sec")
    await new Promise(resolve => setTimeout(resolve, 10000));
    return await prompt(messages);
  }
}

module.exports = agent;

