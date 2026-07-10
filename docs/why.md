# Why I built this

*A draft — corrections and adjustments welcome, this is meant to sound like Oliver, not like a generic "founder story" page.*

I maintain the [UNICORN Binance Suite](https://github.com/oliver-zehentleitner/unicorn-binance-suite) — a set of open-source Python packages for building trading systems on Binance, some of it running in production for years. Long-lived code is not an abstract problem for me; it's what I work in every day.

I also work with AI coding agents constantly, and I noticed something specific: before any code gets written, there's usually a real conversation — about tradeoffs, about why one approach over another, about a workaround for something external. The agent is *there* for that conversation. It already documents outcomes reasonably well. What it wasn't doing was turning that discussion into something that survives past the session.

That's the actual gap. Docs and changelogs already get maintained close to automatically today — a skill or an agent keeps them current alongside the work, with barely any extra effort from the person doing it. Nobody has to remember to update a changelog by hand anymore if the tooling is set up right. The "why" was the one layer that hadn't caught up to that. Once I noticed it, it seemed obvious: the same low-effort, agent-maintained pattern that already works for *what changed* should work for *why* it changed too.

I've described it, half-joking, as Docker for reasoning — Docker made environments portable so nobody has to ask "how is the server set up" anymore; this is meant to make reasoning portable so nobody has to ask "why is it built this way" either. The analogy isn't perfect (Docker is a hard, enforced guarantee; this is soft, and only as good as what actually gets captured) but it's close enough to explain the shape of the idea quickly.

Keep the Why isn't the first attempt at this — see "Not a green field" in the [README](https://keepthewhy.com/) for the prior art it builds on and differs from. What convinced me it was worth shipping as its own thing was applying it to the two modes that matter most in practice: capturing rationale as it happens, and recovering it from someone who's about to leave with it still in their head.

More on how I work with AI agents day to day: [blog.technopathy.club](https://blog.technopathy.club) · [GitHub](https://github.com/oliver-zehentleitner)
