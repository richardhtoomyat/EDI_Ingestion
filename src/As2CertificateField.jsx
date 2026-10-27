import { useState } from 'react'

export default function As2CertificateField({ value, onChange, error: externalError }) {
  const [localError, setLocalError] = useState('')
  const selected = value?.name
  const error = localError || externalError

  return (
    <label className={`field as2-cert-field${error ? ' has-error' : ''}`}>
      <span>AS2 Certificate</span>
      <div className="as2-cert-row">
        <input
          type="file"
          accept=".cer,.crt,.pem,.p7b,.der,application/x-x509-ca-cert,application/pkix-cert,application/x-pem-file,text/plain"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (file.size > 256 * 1024) {
              setLocalError('Certificate must be 256 KB or smaller')
              onChange?.(null)
              return
            }
            try {
              const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result || ''))
                reader.onerror = () => reject(new Error('Could not read that certificate'))
                reader.readAsDataURL(file)
              })
              setLocalError('')
              onChange?.({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                dataUrl,
              })
            } catch {
              setLocalError('Could not read that certificate')
              onChange?.(null)
            }
          }}
        />
        <div className={`as2-cert-pick${selected ? ' has-file' : ''}`}>
          <span className="as2-cert-name">{selected || 'Choose certificate file…'}</span>
          {selected && (
            <button
              type="button"
              className="secondary as2-cert-clear"
              onClick={(event) => {
                event.preventDefault()
                setLocalError('')
                onChange?.(null)
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <span className="hint">.cer, .crt, .pem, or .p7b</span>
      {error && <em role="alert">{error}</em>}
    </label>
  )
}
