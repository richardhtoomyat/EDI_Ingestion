import { useState } from 'react'

export default function HostingRequest() {
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <div className="hosting-sent" role="status" aria-live="polite">
        <span className="verify-tick" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="12" fill="#0095F6" />
            <path d="M6.8 12.4l3.2 3.2 7.2-7.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
          </svg>
        </span>
        <span>Sent</span>
      </div>
    )
  }

  return (
    <div className="hosting-request">
      <button type="button" onClick={() => setSent(true)}>
        Send request to Michael Wright
      </button>
    </div>
  )
}
