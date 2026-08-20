# Step 17.6 — Split Rename Animation Restored

- Restored the one-by-one workout-day rename sequence when applying a split.
- The Apply Split confirmation still closes immediately.
- The visible day names animate sequentially at about 160 ms per day.
- The actual Convex split update remains one atomic mutation, so a failed request cannot leave only part of a split saved.
- Keeps all Step 17.5 pre-public QA fixes, including centered dialogs and no forced keyboard on Add Exercise.
