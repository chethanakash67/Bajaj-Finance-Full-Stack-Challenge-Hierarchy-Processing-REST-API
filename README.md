# SRM Full Stack Engineering Challenge

This repository now contains two separate apps:

- `backend/`: Express API for deployment on Render
- `frontend/`: Next.js app for deployment on Vercel

The backend exposes `POST /bfhl` and the frontend calls it through an environment-configured base URL.

## Project Structure

```text
.
├── backend
│   ├── package.json
│   ├── scripts
│   │   └── runSample.js
│   └── src
│       ├── config.js
│       ├── graphService.js
│       └── server.js
├── frontend
│   ├── app
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── next.config.mjs
│   └── package.json
└── README.md
```

## Replace Your Personal Details

Update the placeholders in [backend/src/config.js](/Users/chethanakash/Desktop/bajaj%20finance/backend/src/config.js:1):

```js
const USER_DETAILS = {
  user_id: "yourname_ddmmyyyy",
  email_id: "yourmail@college.edu",
  college_roll_number: "YOUR_ROLL_NUMBER",
};
```

Replace:

- `yourname_ddmmyyyy` with your `fullname_ddmmyyyy`
- `yourmail@college.edu` with your real email
- `YOUR_ROLL_NUMBER` with your roll number

## Tech Stack

- Backend: Node.js, Express, CORS
- Frontend: Next.js, React
- Styling: plain CSS
- Deployment target: Render for backend, Vercel for frontend

## Backend API

### Endpoint

```http
POST /bfhl
Content-Type: application/json
```

### Request Body

```json
{
  "data": ["A->B", "A->C", "B->D"]
}
```

### Response Fields

- `user_id`
- `email_id`
- `college_roll_number`
- `hierarchies`
- `invalid_entries`
- `duplicate_edges`
- `summary`

### Rules Implemented

- Only `X->Y` is valid where both sides are single uppercase letters
- Leading and trailing spaces are trimmed before validation
- Self-loop edges like `A->A` are invalid
- Duplicate edges are processed only once and reported once
- If a node gets multiple parents, the first valid parent wins
- Multiple independent groups are supported
- Root means a node that never appears as a child
- Pure cycles fall back to the lexicographically smallest node as root
- Cyclic groups return `has_cycle: true` and no `depth`
- Non-cyclic trees return `depth`
- `summary.total_trees`, `summary.total_cycles`, and `summary.largest_tree_root` are computed dynamically

## Run Locally

### 1. Start the backend

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/backend"
npm install
npm run dev
```

Backend URL:

```text
http://localhost:3000
```

### 2. Start the frontend

In a second terminal:

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/frontend"
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend URL:

```text
http://localhost:3001
```

## Frontend Environment Variable

Set this in [frontend/.env.local.example](/Users/chethanakash/Desktop/bajaj%20finance/frontend/.env.local.example:1) or Vercel project settings:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

For production, replace it with your deployed Render backend URL.

## Backend Environment Variables

Use [backend/.env.example](/Users/chethanakash/Desktop/bajaj%20finance/backend/.env.example:1) as reference:

```bash
PORT=3000
HOST=0.0.0.0
FRONTEND_URL=http://localhost:3001
```

For production, set `FRONTEND_URL` to your Vercel domain to keep CORS tight.

## Sample Request

```json
{
  "data": [
    "A->B",
    "A->C",
    "B->D",
    "C->E",
    "E->F",
    "X->Y",
    "Y->Z",
    "Z->X",
    "P->Q",
    "Q->R",
    "G->H",
    "G->H",
    "G->I",
    "hello",
    "1->2",
    "A->"
  ]
}
```

## Sample Response

```json
{
  "user_id": "yourname_ddmmyyyy",
  "email_id": "yourmail@college.edu",
  "college_roll_number": "YOUR_ROLL_NUMBER",
  "hierarchies": [
    {
      "root": "A",
      "tree": {
        "B": {
          "D": {}
        },
        "C": {
          "E": {
            "F": {}
          }
        }
      },
      "depth": 4
    },
    {
      "root": "G",
      "tree": {
        "H": {},
        "I": {}
      },
      "depth": 2
    },
    {
      "root": "P",
      "tree": {
        "Q": {
          "R": {}
        }
      },
      "depth": 3
    },
    {
      "root": "X",
      "tree": {},
      "has_cycle": true
    }
  ],
  "invalid_entries": ["hello", "1->2", "A->"],
  "duplicate_edges": ["G->H"],
  "summary": {
    "total_trees": 3,
    "total_cycles": 1,
    "largest_tree_root": "A"
  }
}
```

## Test with cURL

```bash
curl -X POST http://localhost:3000/bfhl \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      "A->B", "A->C", "B->D", "C->E", "E->F",
      "X->Y", "Y->Z", "Z->X",
      "P->Q", "Q->R",
      "G->H", "G->H", "G->I",
      "hello", "1->2", "A->"
    ]
  }'
```

## Test with Postman

1. Create a `POST` request to `http://localhost:3000/bfhl`
2. Set `Content-Type: application/json`
3. Choose `Body -> raw -> JSON`
4. Paste the sample request
5. Send the request

## Verify the Backend Sample Quickly

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/backend"
npm run test:sample
```

## Deployment

### Deploy Backend on Render

1. Push the repo to GitHub
2. Create a new Render Web Service
3. Set the root directory to `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:

```text
PORT=3000
HOST=0.0.0.0
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Deploy Frontend on Vercel

1. Import the same repo into Vercel
2. Set the root directory to `frontend`
3. Add environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com
```

4. Deploy

## Notes

- The backend response is fully dynamic and not hardcoded
- The sample challenge logic matches the expected output
- The implementation comfortably handles the stated input size
