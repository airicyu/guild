我想做一個自動工作流系統,

會預先定好一些不同角色的agents.

我隨時會把一些問題/任務drop進去任務欄,
有些任務可能是先放下來但未打算做的,
有些任務可能是放下來就打算做的,

打算做的任務發出來, 會觸發一些agent去評估任務,
project owner agent去form AI小隊幫我管理任務, 進行任務, 匯報進度.

有一個任務大龐, 我可以在那裡看到有什麼任務在進行,
我隨時可以打開任務房間, 看到agent的可視化匯報.

我還想整個系統可以隨時暫停(例如要關電腦),
又可以之後打開電腦後resume系統的.
所以關於任務組隊,
我覺得組員構成時, 要是把"組成"寫下來, 之後resume時能組回來。
另外, 任務及任務組員, 也需要有一個memory space, 把事情記下來, 那暫停後resume也能再次繼續工作

系統架構建議的Option A：Event-driven Orchestrator, 這個我覺得可能會太rigid?
寫入DB 是確定性高, 但讀取得靠DB query, 對AI agent來說是否不夠彈性?
(但用file 的話parallel agent寫入會否很頭痛?)

"Agent Runtime 只做執行單次 prompt / 長跑 session" <--我覺得這樣會比較大限制了.

任務的進行, 由於context限制, 基本上我覺得很可能是要多輪多步的,做的時候分拆一個個進程做, 例如以artifacts傳下去那樣?
避免單一context不斷變大工作。

另外, 由於可能有多任務同時進行, 每個任務本身也需要是平行獨立工作的。各workspace要有isolation.



每個任務我想可能是一些agent cli進程形式?
我也在想, 當我想介入時, 我是用什麼形式介入?
像freeflow那樣, 打開該cli terminal介面? 我在terminal chat直接問team lead?
(freeflow那個我只是玩具, 我不確定是否有用)

-----

# 界面

在項目本身結構下, 可能會有一個folder.
我可能在cursor/VS CODE打開, 直接寫一個markdown file在裡面。
這樣就構成了任務生成, 所以不用做任務生成的UI。
任務folder下有"parking", "ready", "active", "archive" folder,
我生成mission file會放到parking or ready folder.
ready的就是可以開始做的, 系統會pick up並搬到active及組team.
(這不影響你說的mission會分Parked | Evaluating | Running | Blocked | Done state的內部管理state)

UI 上有個任務板是看任務的,
任務板旁有個Bell button, 我按一下系統就會refresh check mission folders to check whether there are new missions

UI 有個"任務大廳"
下面有一些任務房間, UI 以card 表示, Card內容是任務team 寫的簡短進度情況可視化內容.
Card裡有個"進入" button.
進入後切到任務版面,
展示的是任務的detail進度情況可視化內容.
以及組員資訊.
將來可能會有memory展示, 但暫時不用, 我可以直接在IDE看mission team memory file.

假切任務是要做一個program之類artifact, 不要把program與mission meta資訊混在一起。

------

# File and folder structures:

- mission-board
    - parking
    - ready
        - mission-apple-abcde
            - freely any files.....
            - mission.md
    - active
    - archive
- mission-rooms
    - mission-apple-abcde
        - squad.md (md + yaml frontmatter)
        - checkpoint.yaml
        - inbox.md
        - outbox.md
        - memebers
            - project-owner
                - agent.md
            - evaluator
                - agent.md
            - specialist
                - agent.md
            - reporter
                - agent.md
            ...(can freely have any members)
        - memories
            - common
                - chatroom.jsonl
                - events.jsonl
                - memory.md
                ...freely usages
            - members
                - project-owner
                    - ... freely usages
                - ... (each team member can have their own memories)
        - artifacts (free folders)
            - project xxxx...
            - something something...
        - mission-reports
            - overview.md
            - daily
                - YYYY-MM-DD.md(daily progress reports)
            - visualization
                - detail.html (may be 任務房間裡detail progress展示用?)
                - overview.html (may be 任務房間 card preview展示用?)
- mission-rooms-achive

----

# mission memory

common memory 裡有 chatroom.log.
log 每行一筆 structured record（JSONL 比純 text 好 parse）
chatroom.log 用 append-only log
把append-only log寫成一個 script tool.
agent 想chatroom說話時, call script tool 寫入到log, log裡記下是誰說的及什麼時候說的。

common memory 裡有memory.md
這個是任何member也可讀, 但只能由team lead寫入. team member想修改需跟team lead談談叫team lead考慮改。

common memory 的memory.md 跟team lead的memory.md, 也是由team lead去manage.
兩者分別在於,
team lead 的memory.md是記錄它自己做事的個人觀察觀感memory.
common memory 的memory.md, 是project及team維度的公共memory共同維護, 只是是由team lead作為guardian去判決寫入.

所有memory都是自由read的, 不會禁止agent read, 但write會有邊界限制。

----

# mission-board

mission-board的那個只是一個mission的initial note.
後續我可能會改, 然後叫mission team 參看修改, 但我也可能不改的.
總之就是一個參考.

實際mission team在開工後, mission source of truth就會轉移到mission room.

把 handoff 做成 明確的一次性事件：
```
ready/mission-apple-abcde/mission.md
        ↓  [Bell → orchestrator pickup]
active/（stub 或 symlink）
mission-rooms/mission-apple-abcde/ 建立
        ↓  PO 第一輪必讀 mission.md，產出：
           - squad.md
           - common/memory.md 初稿（從 mission.md distill）
           - 可選：memories/common/mission-brief.md（frozen copy）
```

----

# 我怎麼介入

----

將來的功能:
- 養成可重用skill(其實也就是一些prompt/tool), equip到任務成員agent去用。
- 任務拆分
- 匯報通知channel (desktop notification?)
- mission retrospective
- 做一個inbox channel是可以由team那邊自主決定發signal向我提問, 然後我有空時去回應
- 工作狀態可視化UI (team member avatar在工作的animation)
- trophy系統, 完成任務後的成長及成就(gamification for agent)
- 讓team 做完一件事後能繼續人格存活去做之後的任務
- memory一直寫還是會有太長的時候, 要用某些方法真的像memory, 分檔寫入, 按需讀取, 但AI又懂怎有效找memory