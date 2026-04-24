# SRM Full Stack Engineering Challenge

A deployment-ready full-stack submission for the SRM Full Stack Engineering Challenge.

- Frontend: Next.js dashboard for Vercel
- Backend: Node.js + Express API for Render
- Endpoint: `POST /bfhl`

## Hosted URLs

- Hosted frontend URL: `https://your-vercel-app.vercel.app`
- Hosted API base URL: `https://your-render-backend.onrender.com`
- GitHub repo URL: `https://github.com/your-username/your-repo`

Update those values in:

- [frontend/.env.local.example](/Users/chethanakash/Desktop/bajaj%20finance/frontend/.env.local.example:1)
- [backend/.env.example](/Users/chethanakash/Desktop/bajaj%20finance/backend/.env.example:1)

## Project Structure

```text
.
├── backend
│   ├── package.json
│   ├── scripts
│   │   └── runSample.js
│   ├── src
│   │   ├── app.js
│   │   ├── config.js
│   │   ├── graphService.js
│   │   └── server.js
│   └── test
│       ├── api.test.js
│       └── graphService.test.js
├── frontend
│   ├── app
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── next.config.mjs
│   └── package.json
└── README.md
```

## Backend Identity Fields

The API response includes:

- `user_id`
- `email_id`
- `college_roll_number`

These are configurable through environment variables in [backend/src/config.js](/Users/chethanakash/Desktop/bajaj%20finance/backend/src/config.js:1):

```bash
USER_ID=fullname_ddmmyyyy
EMAIL_ID=yourmail@college.edu
COLLEGE_ROLL_NUMBER=YOUR_ROLL_NUMBER
```

If they are not set, the backend falls back to placeholders and logs a warning.

## API Details

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

### Validation Rules

- Input is trimmed before validation
- Valid format is only single uppercase letter to single uppercase letter, like `A->B`
- Spacing like `A -> B` is accepted and normalized
- Invalid examples: `hello`, `1->2`, `AB->C`, `A-B`, `A->`, `A->A`, empty string
- Self-loops are treated as invalid, not cyclic
- Duplicate edges use the first occurrence and appear only once in `duplicate_edges`
- Multi-parent children keep the first valid parent and silently discard later parent edges
- Pure cycles use the lexicographically smallest node as root
- Any connected component containing a cycle returns:

```json
{
  "root": "X",
  "tree": {},
  "has_cycle": true
}
```

- Cyclic groups do not include `depth`
- Non-cyclic trees include `depth`
- `summary.total_trees` counts only valid non-cyclic trees
- `summary.total_cycles` counts cyclic groups
- `summary.largest_tree_root` picks the deepest tree root, breaking ties lexicographically

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

## Local Setup

### Backend

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/backend"
npm install
npm run dev
```

Backend runs at `http://localhost:3000`.

### Frontend

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/frontend"
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3001`.

## Test Commands

Backend sample verification:

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/backend"
npm run test:sample
```

Backend automated tests:

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/backend"
npm test
```

Frontend production build check:

```bash
cd "/Users/chethanakash/Desktop/bajaj finance/frontend"
npm run build
```

## cURL Example

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

## Postman

1. Create a `POST` request to `http://localhost:3000/bfhl`
2. Add header `Content-Type: application/json`
3. Choose `Body -> raw -> JSON`
4. Paste the sample request body
5. Send the request

## Deployment

### Render Backend

1. Push the repository to GitHub
2. Create a new Render Web Service
3. Set root directory to `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:

```text
PORT=3000
HOST=0.0.0.0
FRONTEND_URL=https://your-vercel-app.vercel.app
USER_ID=fullname_ddmmyyyy
EMAIL_ID=yourmail@college.edu
COLLEGE_ROLL_NUMBER=YOUR_ROLL_NUMBER
HOSTED_FRONTEND_URL=https://your-vercel-app.vercel.app
HOSTED_API_URL=https://your-render-backend.onrender.com
GITHUB_REPO_URL=https://github.com/your-username/your-repo
```

### Vercel Frontend

1. Import the same repository into Vercel
2. Set root directory to `frontend`
3. Add environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
NEXT_PUBLIC_GITHUB_REPO_URL=https://github.com/your-username/your-repo
```

4. Deploy

## Notes

- CORS is enabled in the backend
- `POST /bfhl` accepts `application/json`
- The response is dynamic and not hardcoded
- The implementation is designed for the challenge limit of up to 50 nodes
