# Feature 1: artifact release

## description

Now when mission completed. It just put output into artifact folder.
And sometimes when some mission is ask for "Update guild-master skill", at final stage the mission team would deploy the skill to the guild-desk.
The problem is, it is uncertain for what should be do for the output artifact.
the "auto-deploy" to guild-desk looks intelligent, but i think it is also just vibe, not clear and certain.
Propose that, we should have a proper defined way to handle on what should be done for the output artifact.

brainstorm idea:
mission scope evaluating phase should also have communication of the after-mission-artifact handling.
PO May confirm with guild master what should be done with the artifact. Can ask with:
- Stay in the artifact folder <---default option if unknown context
- Auto deploy to somewhere <--- if user answer this, ask again for where to deploy. default option if user stated update/release for somewhere explicitly already in initial context.
- Others, let guild master talk

If we defined the artifact release phase,
then after the mission is done and approved.
the mission shall handle the artifact release before dismiss.

note: discovery team artifacts must be missions, so they dun need artifact release phase. The existing logic turning ideas into mission is already the release meaning for them.

# Feature 2: mission retrospective

Now after mission is done and approved, and then after artifact release is done.
The mission team should do a retrospective meeting.
team lead collect feedbacks from teamates(including tema lead itself) about:
- General feedback about the mission journey
- What things are doing good? (if any)
- What things are doing bad? (if any)
- Anything is lacking for the workflow? (if any)
- Anything is not useful for the workflow? (if any)
- Any improvement on the mission workflow can be done? (if any)
- Any feedback on the skills wired on agents? (if any) (Now we didn't implement "skills system" that everytime forming team may grab skills and wired to agents, no right now just no skills)
- Anything worth to distill into new skills that is useful and re-usable in future missions.

team lead collect feedbacks and drop down the feedback from individual members. And then finally write a combined report.
The combined report is self-contained that have brief section to talk about what this mission is doing for the background understanding.
And then the feedback contents. No need to mention about the skills retro details, but just some brief talking about what skill reports are there.


output files be like:

```
<mission folder>
- retrospective
    - members
        - project-owner
            - feedback.md
        - evaluator
            - feedback.md
        .....
    - workflow-report.md (The combined report written by team lead)
    - skills-reports
        - {some short name}.md
```

for the skills-reports, there are two kind of stuff:
1) Feedback on the existing agent skills, kind of talk about clearly thought on how to improve the skills, or may be even talk about skill is useless and think about remove this skill. Or think about combining some skills tgt.
2) Feed back on distill or creating some new agents skills for future re-usable usages.

-------

# Feature 2: mission approval flow refactor

now the approve mission workflow is:
- guild master file approve button -> orchestrator -> dismiss team
- guild master go to team chat, manual say approval -> po fire signal for approval -> orchestrator -> dismiss team

problem:
current workflow approval would directly dismiss the team.
But we have :
- Feature 1: artifact release
- Feature 2: mission retrospective
which both are defined as after-approval workflow. The team need to live longer after approval to work for those stuff.

solution:
- approval workflow need to refactor to not to be dismiss team, instead it should be change to some way that can notfy the mission team (project owner) that the mission result is approved. so that the team can proceed to next phases for release and then retrospective.

after retrospective is done, the mission enter the completed phase. Then the project owner can send signal for mission team dismiss -> orchestrator -> dismiss team.

But I think this feature's hard part is finding ways that feasible to notify the mission team approved if it is driven from web UI (i.e. orchestrator) side. Need to think about it.

-------

# Feature 3: backlog ideas
adding a backlog ideas column to the workflow.
some ideas may be just want to parking but not yet ready for go. 
now if we created ideas in ideas column, once we ring bell, it will go. some ideas we may want to think more before go.
later on guild master can on web ui click action for idea button to promote the idea from backlog idea to the idea column to work it out

-------

# Feature 4: Agent skills & skills bank
We may have a bank of agent skills.
They are just similar to claude skills (a skill folder, inside there is at least a SKILL.md with frontmatter, but it can also has much more stuffs on demand.....)

Whenever a discovery team or mission team is forming to work, before the team is forming, main agent(actually project owner) should check the skills bacnk and think about what skills are goods for and assign them to the upcoming-members. (May be each agent can have different skills). the main agent copy all required skills from skills bank to the team's .claude skills folder.

So mission folder be like:
```
<mission folder>
- .claude
    - skills
        - ..... (copy the skills from skill bank into this folder)
- members
    - developer
        - agent.md
        - skills.md (talk about which skills the agent should be injected and available to use)
    ...
....
```

discovery:
```
<discovery room folder>
- .claude
    - skills
        - ..... (copy the skills from skill bank into this folder)
- members
    - ???
        - agent.md
        - skills.md (talk about which skills the agent should be injected and available to use)
    ...
....
```

the skill bank live under guild-house's data folder

```
guild-house
- data
    ....
    - skills-bank
        - .... <----the claude skills
        - catelog.md
```

I am thinking whether we should groupd the skills under the skills-bank or not, may be not grouped.
We maintain a catelog.md that has brief description for all the skill

-------

# Future ideas but not now? team formation committee.
at the beginning of the discovery / mission session, form a team formation comittee team to evaluate the team formation about:
- which kind of team members should be there
- what skills from skill bank should be wired on which team members
- copy the required alls skills from skills bank to the mission's ".claude" folder.
then dismiss the team formation comittee team, then main agent according to the team formation material to form the working team to work for the discovery/mission. 