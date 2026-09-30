# Private Event Eligibility Pass (PEEP)



A privacy-preserving event access system built with Midnight Network. PEEP allows participants to prove that they satisfy an event eligibility requirement without unnecessarily revealing their private information.



## What This Does



PEEP separates **eligibility verification** from **identity disclosure**.



A participant can prove eligibility using private information while the blockchain stores only the information required for verification and pass lifecycle management.



Basic flow:



1. Participant provides private eligibility information.

2. The eligibility requirement is verified.

3. A privacy-preserving proof is generated.

4. An event pass is created.

5. The pass is represented as a QR code.

6. An organizer scans the QR code.

7. The system verifies whether the pass is valid.

8. After successful entry, the pass is marked as used.

9. Reusing the same pass is rejected.



**Core principle: VERIFY ELIGIBILITY, NOT IDENTITY.**



## Privacy Model



PEEP is designed to minimize unnecessary disclosure of participant information.



### Public information



The contract can maintain information required for verification and pass lifecycle management, such as:



- Event identifier

- Eligibility commitment/hash

- Pass identifier

- Event active status

- Pass active status

- Entry-used status



### Private information



Sensitive eligibility information is intended to remain private and can be used as a private witness for the eligibility proof.



The system does not require unnecessary personal information to be revealed to the event organizer during normal verification.



## One-Time Pass Protection



Each pass follows a lifecycle:



```text

ACTIVE → USED

```



## How It Works



1. The organizer creates an event with a public event identifier and eligibility commitment.
2. The participant supplies a private eligibility witness to the Compact circuit.
3. The circuit verifies eligibility and issues a pass containing only public identifiers and status.
4. The participant presents the pass as a QR code.
5. The scanner verifies the public pass state and marks the pass as used after entry.
6. The on-chain state prevents the same pass from being used again.



## User Types



- **Participant:** Proves eligibility and receives a one-time event pass.
- **Organizer:** Creates events and defines their eligibility requirements.
- **Scanner:** Verifies a pass at entry and records its one-time use.



## QR Code



The QR code contains only the pass identifier and event identifier. It does not contain a private credential, eligibility witness, name, email, phone number, student identifier, or institution.



## Security and Replay Protection



Eligibility is checked by the Compact circuit, and only the eligibility result and pass identifier are disclosed. The contract rejects invalid witnesses, wrong event identifiers, invalid passes, and attempts to use an already-used pass. Replay protection is enforced by the on-chain transition from `NOT_USED` to `USED`.



## Tech Stack



- Midnight Compact contract
- TypeScript and Node.js
- React, Vite, and TypeScript frontend
- Node.js test runner with fast-check property tests
- QR code generation and scanning dependencies in the frontend



## Project Structure



- `contracts/event_eligibility_pass.compact` — Compact contract circuits and ledger state.
- `src/` — TypeScript CLI and deployment wiring.
- `frontend/` — React and Vite user interface.
- `tests/` — Unit and property-based tests.
- `.github/workflows/ci.yml` — Continuous integration workflow.
- `PROPOSAL.md` — Product proposal and privacy assessment.



## Installation



1. Install Node.js 22.
2. Install the Midnight Compact CLI if contract compilation or deployment is required.
3. Run `npm install` in the project root.
4. Run `npm install` in `frontend/`.



## Run Tests



```bash
npm test
```



## Run Frontend



```bash
cd frontend
npm run dev
```



## Build Frontend



```bash
cd frontend
npm run build
```



## CI/CD



The GitHub Actions workflow uses Node.js 22, installs root and frontend dependencies, runs the root test suite, and builds the frontend. Compact contract compilation runs only when the `compact` CLI is available, so standard CI environments can still run the tests and frontend build. No GitHub Actions run has been verified for this repository.



## Contract Address / Deployment Status



Contract address: Not deployed yet.



The repository contains deployment wiring, but no verified Midnight deployment or deployment state file is present. A real deployment requires the Midnight SDK, compiled contract artifacts, wallet approval, and network access.



## Mainnet Feasibility



The design is suitable for a focused testnet deployment and later mainnet evaluation. Mainnet use requires production network availability, completed SDK integration, proof-server setup, wallet integration, and a security audit of the Compact contract.



## Current Limitations



- The current contract design manages one pass per contract instance.
- The deployment script is wiring only and does not perform a verified SDK deployment.
- Frontend and CLI integration with a real Midnight wallet and indexer remains to be completed.
- The QR scanner workflow depends on the browser and wallet/network environment.



## Security Notes



- Never commit environment files, wallet data, private keys, seed phrases, or deployment state.
- Keep eligibility witnesses and private credentials off-chain and out of logs, QR codes, and error messages.
- Review the Compact circuits and deployment process before using real credentials or mainnet assets.
- The repository security scan found no actual private keys, wallet seeds, API keys, or `.env` secrets.



## Project Status



The Compact contract, root test suite, frontend source, and CI configuration are present. The root tests and frontend production build have been verified locally. A real Midnight contract deployment has not been performed.



## Proposal



See [PROPOSAL.md](PROPOSAL.md) for the product description, user types, Midnight rationale, data model, privacy audit, mainnet feasibility, and limitations.
