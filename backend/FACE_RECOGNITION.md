# Face recognition for attendance

## How it is put together

Three pieces have to agree, or matching silently stops working:

1. **The model** — MobileFaceNet, running on the employee's phone. It turns a
   face photo into 192 numbers (an "embedding").
2. **Enrolment** — the employee's first sign-in captures one good face and
   sends that embedding to the server, where it is stored.
3. **Verification** — at duty start and duty end, the app sends a fresh
   embedding. The server compares it to the stored one and returns a score
   between 0 and 1.

Everything the app sends is checked on the server. The phone never decides
whether a face matched.

---

## Why enrolment happens on the phone, not at the admin desk

You asked for the face to be captured during onboarding. It is — just from the
employee's phone rather than the admin's webcam, and here is why that matters.

A face embedding is only comparable to another embedding from the **same
model**. A webcam photo processed in the browser and a phone selfie processed
on the device produce numbers that do not line up, so every check would fail.

Even with the same model, a laptop webcam in an office and a phone camera in
sunlight give different enough images that scores drop. Enrolling on the same
phone the employee will use every day is what keeps false rejections rare.

In practice the flow is still an onboarding step:

1. Admin creates the employee in the console. They show as **Face: Pending**.
2. Employee signs in on the app. Before anything else, they are asked to
   register their face, with an explanation and a consent checkbox.
3. From then on, duty start and duty end both need a matching face.
4. Admin sees the registered photo, every check with its score, and can reset
   the registration when someone changes phone.

An employee who has not registered cannot start duty. That is deliberate — it
is what makes the register trustworthy.

---

## Getting the model file

The model is not in this repository because of its licence. Download it once
and put it in the Flutter app:

```
app/assets/models/mobilefacenet.tflite
```

A widely used copy lives in the `MobileFaceNet_TF` and `Face-Recognition-Flutter`
projects on GitHub — search for `mobilefacenet.tflite`. Any MobileFaceNet
variant with a **192-dimension** output works. If you use a model with a
different output size, change `EMBEDDING_LENGTH` in `src/utils/face.ts` to
match, and re-enrol everyone: old embeddings are not comparable to new ones.

---

## Tuning the threshold

Default is **0.70**, stored in the `settings` table under the `face` key:

```sql
UPDATE settings
   SET value = '{"threshold":0.72,"maxAttempts":5,"requireForDuty":true}'::jsonb
 WHERE key = 'face';
```

- **Higher** (0.75–0.80) — harder to fool, but more genuine employees get
  rejected on a bad-light morning.
- **Lower** (0.60–0.65) — smoother for staff, but two people who look alike
  start passing for each other. Brothers and cousins on the same team are the
  usual case.

Start at 0.70. Watch the scores in the admin console for the first two weeks —
`face_verifications` records every attempt, pass or fail — then adjust to what
your actual staff and phones produce.

---

## What this does and does not stop

**It stops** the ordinary problem: one person marking attendance for an absent
colleague from their own phone.

**It does not stop** someone holding up a printed photo or a phone screen
showing a photo. That needs liveness detection — a blink or head-turn prompt —
which the app can add through ML Kit face detection. Worth doing before this
goes to a client who is counting on it for payroll.

**It is not perfect.** Expect occasional false rejections from bad light, a new
beard, or a cracked lens. That is why:

- Failures are recorded but do not lock the account permanently.
- After 5 failures in 30 minutes, the message tells the employee to ask their
  manager, rather than repeating the same instruction.
- An admin can turn the face requirement off for one employee, with a reason
  that goes into the audit log.

Do not tie pay to a face score without a human reviewing failures. Someone
whose phone camera has degraded should not lose a day's wage over it.

---

## Privacy and law

Face templates are biometric data. Under India's DPDP Act 2023 this is personal
data that needs a clear purpose and the employee's consent, and it should be
kept no longer than the purpose requires.

What this system does:

- Stores the **embedding**, not a reusable face key. An embedding cannot be
  turned back into a photograph.
- Records a consent timestamp at enrolment. The app must show what is being
  collected and why before that call is made — do not remove that screen.
- Keeps selfies so a human can review a disputed check. Decide a retention
  period with your client (90 days is common) and delete older ones.
- Logs every reset and every requirement change against the admin who did it.

What you should still do before delivery:

1. Give the client a short written notice for their staff: what is collected,
   why, who can see it, how long it is kept.
2. Agree a retention period and set up deletion of old selfies.
3. Agree what happens when the check fails — who overrides, and how it is
   recorded.

Tell the client plainly that this is biometric data. If they take employee
attendance to a labour dispute, the audit trail is what makes their position
defensible; a system that quietly guesses does the opposite.

---

## Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/face/status` | Employee — am I enrolled? |
| POST | `/face/enroll` | Employee — embedding + selfie + consent |
| GET | `/face/employees/:id` | Admin — enrolment and check history |
| POST | `/face/employees/:id/reset` | Admin, HR — clear registration |
| PATCH | `/face/employees/:id/requirement` | Admin — turn the check off, with a reason |

`POST /attendance/start` and `/attendance/end` accept `faceEmbedding` and
`selfie`, and reject the call with code `face_mismatch` when the score falls
below the threshold.
