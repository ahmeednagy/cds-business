# Chat & Calls — User Guide

## What this does
Chat with colleagues in real time, and start voice or video calls right from
the conversation. Every call leaves a small event in the chat history — missed
calls, cancelled calls, declines, and completed calls with their duration.

## Prerequisites
- Logged in with an active account.
- For calls: allow microphone (and camera for video) when the browser asks.

## Starting a chat or call
1. Click the **chat icon** in the top bar → pick a conversation, or press
   **New message** and search a colleague's name.
2. In the chat window header:
   - 📞 **phone icon** = voice call
   - 🎥 **camera icon** = video call

## What happens during a call
```
[You call] → [They ring ~30s] → { Accept → talk → either side can end }
                              → { They decline / time out / you cancel }
```

- **They don't answer**: after ~30 seconds the ringing stops by itself. Their
  chat shows **Missed voice/video call** and their chat badge goes up by one.
  Yours shows **Voice call — No answer**.
- **You cancel before they answer**: their ringing stops instantly. They see
  **Missed call**; you see **Voice call cancelled**.
- **They decline**: you immediately see the call was declined; the event shows
  on both sides.
- **Connected call**: when anyone hangs up, both see **Voice call — mm:ss**
  with the real talk duration.
- **Call back**: on a missed call in *your* chat, press **Call back** to
  redial with the same call type.

## Unread behaviour
A missed call counts like a message: the chat bell badge and the conversation
badge increase until you open that conversation.

## Notifications
A missed call also creates a notification ("Missed voice call from …").
Clicking it opens your Chats page.

## Common mistakes
- **No mic permission** → the call fails instantly and is logged as a failed
  call. Check the browser permission icon in the address bar.
- **"User is busy"** → the colleague is already on a call; wait and retry.
- Closing the browser tab while ringing doesn't cancel the call — it will
  time out normally and be recorded as missed.

## FAQ
- **Does the timer count ringing time?** No — duration starts when the call
  is answered.
- **Can I see old calls after logging out?** Yes, they're permanent history
  entries inside the conversation.
- **Do I get notified about my own outgoing calls?** No — your own call events
  never raise your unread count.

## Update (2026-10-16)
- The Chats dropdown now shows only conversations with real history —
  colleagues you have actually messaged or called. People you have never
  chatted with no longer appear.
- To talk to someone new: click **New message**, search their name, and
  send a message or place a call. The conversation then appears in your
  Chats list automatically.
