# Create agents file

AGENTS.md
```markdown
# Architecture

- always use pnpm and typescript
- always run things with tsx and not have a seperaete build
- prefer to use node --test over external frameworks
- always use the latest version of the library

# Planning

- if you don't have a agreed upon plan, prompt me to create a prd for the feature
- always lookup the documentation for a feature using context7 or web search
- update the PRD as you are going

# Context

- Always keep a docs/active-context.md file that represents the current working stage of the project.
- when we complete a new phase, put all of your thinking into active context replaceing everything except "pending items"
- when you complete a phase, update the docs/proejct-log.md and the prd with the current state of things and clean out active-context.md with anything not strictly relavent
```

# Prompt:

> how do i use the umwelten library to create a chat agent?

> Lets think through this feature.  What I want to do is to create a tool that I can use to analyse files, for example the files in data.  the output of the will be source code that impements an chat agent using the umwelten framework.  we need to figure out how to write one of these agents as well as building custom tools.  can you look through the docuemtnation website we can plan on how to do this?  document the plan in the docs/ folder


> lets walk through exactly how the features should work and then output the prd.  ask me one question at as time to decide significate features, and suggest what you think would be the best result

> I want to build an agent that looks as a file and understands the structure of it.  We can discuss what types of queries would be useful, or which tools on it would give the good data.  We'd do that by understand the structure of the file.  Then we'd output a set of tools the a general agent would be able to use.  For example, we could run the agent genaror on listenfirst data.  That would be a chat system that would parse the file, let us ask questions about it and how we'd want to model it, and then it would output code that would be able to read files like that in the futre and be able to "understand them".  So we'd figure out what all the headers meant, and then we'd build tools that owuld let is intellgently filter.


# Phase 1

> load @AGENTS.md and @product-requirements-document.md and lets get started and @umwelten-framework-analysis.md 

Lots of fiddling there

# Phase 2

