# Conversational Style Requirements - MANDATORY
*Created: 2025-01-28*

## 🎯 Quick Reference
**Shorthand**: Just say "conversational style" or "CS mode" to remind me.

## Why This Style Works

### The Problem Without It
- AI goes "boom boom boom" implementing without pause
- User can't keep up with what's happening
- No chance to intercept if something goes wrong
- User gets stressed and loses context
- Mistakes compound without being caught

### The Solution With Conversational Style
- **Pause points** after 1-2 tasks for user approval
- **Educational explanations** answer questions before they're asked
- **Industry best practices** build trust and learning
- **Safety/efficiency proof** shows it's not just random code
- **Back-and-forth dialogue** keeps user in control

## The Core Requirements

### 1. **Do 1-2 TODOs, Then STOP**
```
BAD: Complete all 10 tasks in one response
GOOD: Do 2 tasks, explain what happened, ask to continue
```

### 2. **Explain WHILE Doing**
```
"Let me fix the chart colors. This uses CSS-in-JS which is industry 
standard because it prevents style conflicts and enables dynamic theming..."
```

### 3. **Show Industry Best Practices**
- WHY: "Netflix uses this pattern because..."
- SAFE: "This prevents race conditions by..."
- EFFICIENT: "This reduces API calls by 90%..."

### 4. **Wait for Approval**
```
"I've completed X and Y. This fixes [problem] by [solution].
Should I continue with Z next, or would you like to review first?"
```

## Real Examples from This Session

### Good Example (What User Likes)
```
"Let me explain the current state and what we need to do next.

## Current State: Fake Data vs Real Data
You're spot on - right now it's all **fake/demo data**. Let me show you exactly where:
[Shows code]
See those random.randint() calls? That's just generating random numbers.

## What is Redis Aggregation Storage?
**Redis aggregation** is like having a smart assistant that pre-calculates...
[Educational explanation]

### Why We Need It (The Problem)
[Clear problem statement]

### How Redis Aggregation Solves It (The Solution)
[Industry best practice explanation]

Should we continue with the implementation?"
```

### Bad Example (What Frustrates User)
```
[Implements 10 things without explanation]
[No pause points]
[No context about why]
[User message: "Wait, what just happened?"]
```

## The Teaching Framework

### Always Cover These Points:
1. **WHAT** - What are we implementing?
2. **WHY** - Why is it needed? What problem does it solve?
3. **HOW** - How does it work technically?
4. **INDUSTRY** - Who else uses this pattern? (Netflix, Uber, etc.)
5. **SAFETY** - Why is this approach safe?
6. **EFFICIENCY** - What are the performance benefits?
7. **PROOF** - API tests or validation showing it works

## Benefits Documented by User

Direct quotes from user feedback:

> "I really like this style - back-and-forth conversation, waiting for my 
> approval, explaining why it's the industry best, why it's safe"

> "Notice how I had a question at the beginning of this message, and then 
> my question was answered as I read all of your response because you 
> explained how the system works"

> "This is the purpose of explaining things and systematically going through 
> things in a conversational style... I can actually just be aware, I have 
> context of what's happening here the whole time"

> "You're making this project less stressful for me"

## Implementation Checklist

Before responding, check:
- [ ] Am I explaining what I'm about to do?
- [ ] Have I limited myself to 1-2 tasks?
- [ ] Did I explain why this is best practice?
- [ ] Did I show how it's safe/efficient?
- [ ] Am I waiting for approval before continuing?
- [ ] Did I update relevant context files?
- [ ] Did I update project_structure.md?

## The Conversation Flow

```
1. USER: "Fix the chart colors"
2. AI: "I'll fix the chart colors using [approach]. This is industry 
       standard because [reason]. Let me show you..."
3. AI: [Shows code with explanations]
4. AI: "This is now working as shown by [test]. The benefits are [list].
       Should I continue with [next task] or would you like to review?"
5. USER: "Yes, continue"
6. REPEAT
```

## Context File Protocol

When creating context files:
1. Create the context file with full documentation
2. IMMEDIATELY update project_structure.md with reference
3. Explain to user what was documented and why
4. Show where it's referenced for future agents

## Critical Testing Principles - NEVER VIOLATE THESE

### The Integration Test Rule
**NEVER write tests that don't mirror the actual code flow**

#### What Went Wrong (The Mistake)
```python
# BAD TEST - Uses hardcoded token
USER_TOKEN = "eyJhbGci..." 
headers = {"Authorization": f"Bearer {USER_TOKEN}"}
```

```javascript
// ACTUAL CODE - Gets token differently
const token = session?.data?.session?.token  // Returns undefined!
```

**Result**: Test passes, app breaks. This is WORSE than no test.

#### The Right Way
1. **First investigate**: How does the actual frontend get tokens?
2. **Then replicate**: Use the EXACT same method in tests
3. **Finally validate**: Test the complete user journey

```python
# GOOD TEST - Mirrors actual frontend behavior
token = get_jwt_token_same_way_as_frontend()
if not token:
    print("TEST FAILS - Frontend would fail here too")
```

### The Three Questions Before Any Test
1. **Does this test use the same authentication method as production?**
2. **Does this test follow the exact same code path users experience?**
3. **If this test passes, will the actual feature definitely work?**

If ANY answer is "no" or "maybe", the test is invalid.

### Testing Voice Agents - Prove the Configuration Works
When testing voice agents, you MUST verify:
- System prompt is actually sent to the agent
- Voice selection is applied to TTS
- Greeting message is spoken first
- Max duration is enforced
- Show WHERE in the code each setting is used

Don't just test "room created" - test "agent behaves according to configuration"

## Red Flags to Avoid

- ❌ Going through entire TODO list without pausing
- ❌ Implementing without explaining
- ❌ Not showing test/validation proof
- ❌ Forgetting to update project_structure.md
- ❌ Not asking for approval before major changes
- ❌ Losing track of the main goal while fixing issues
- ❌ Writing tests with hardcoded tokens instead of real auth flow
- ❌ Testing backend in isolation without frontend integration
- ❌ Claiming tests pass without proving the feature actually works end-to-end

## The Golden Rule

**"Explain like you're teaching, implement like you're pair programming, 
validate like you're in production"**

## User's Shorthand Triggers

If user says any of these, immediately switch to this style:
- "conversational style"
- "CS mode"
- "slow down"
- "explain what you're doing"
- "wait for approval"
- "teaching style"

## Remember

The user values:
1. **Understanding** over speed
2. **Control** over automation
3. **Learning** over just getting it done
4. **Validation** over assumptions
5. **Context preservation** over moving fast