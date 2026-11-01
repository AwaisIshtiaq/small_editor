import Link from 'next/link'
import {
  MOCK,
  SEG_ADV,
  SEG_ROWS,
  TIPS,
  type Guide,
  type GuideStep,
  type GuideTip,
} from './guide-types'

// Escape then re-linkify the brand name, same contract as the prototype.
function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const linkify = (s: string) =>
  esc(s).replace('Small Editor Desktop', '<a href="/desktop">Small Editor Desktop</a>')

function SegRow({
  label,
  options,
  value,
  hl,
}: {
  label: string
  options: (string | number)[]
  value: string
  hl?: boolean
}) {
  return (
    <div className={`orow${hl ? ' hlr' : ''}`}>
      <b>{label}</b>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o)} type="button" className={String(o) === value ? 'on' : ''}>
            {String(o)}
            {TIPS[String(o)] ? (
              <span className="qm" title={TIPS[String(o)]}>
                ?
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

// Static "screenshot" of the compress form used inside its how-to steps.
function MockBlock({ k, q, adv }: { k: string; q: string; adv: boolean }) {
  return (
    <div className="mk" role="img" aria-label="Example of the Compress PDF options">
      <h4>Compress PDF</h4>
      <p className="s2">Reduce the size of your PDF</p>
      <p className="sel">
        Selected: <b>my presentation.pdf</b>
      </p>
      {SEG_ROWS.map(([key, label, options]) => (
        <SegRow key={key} label={label} options={options} value={key === 'q' ? q : key === 'conv' ? 'None' : key === 'media' ? 'Discard' : '144'} hl={k === key} />
      ))}
      {adv ? SEG_ADV.map(([key, label, options]) => (
        <SegRow key={key} label={label} options={options} value={key === 'speed' ? 'Regular' : 'Keep'} hl={k === key} />
      )) : null}
      <div className="bt">
        <span>Compress PDF</span>
        <u>Less options</u>
      </div>
    </div>
  )
}

function Step({ st, slug }: { st: GuideStep; slug: string }) {
  const isCode = !!st.h && st.h.startsWith('<')
  if (isCode) {
    return (
      <pre className="code">{[st.h, ...(st.paras ?? [])].join('\n').replace(/^<code>|<\/code>$/g, '')}</pre>
    )
  }
  const items = st.items ?? []
  const tips = items.filter((i): i is GuideTip => Array.isArray(i) && i[0] === 'tip')
  const plain = items.filter((i): i is string => typeof i === 'string')
  const list = plain.filter((i) => !/[.!]$/.test(i))
  const sentences = plain.filter((i) => /[.!]$/.test(i))
  const mock = slug === 'compress' && st.h ? MOCK[st.h] : undefined
  return (
    <>
      {st.h ? <h3>{st.h}</h3> : null}
      {(st.paras ?? []).map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: linkify(p) }} />
      ))}
      {sentences.map((p, i) => (
        <p key={`s${i}`}>{p}</p>
      ))}
      {list.length ? (
        <ul className="al">
          {list.map((i, k) => (
            <li key={k}>{i.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ul>
      ) : null}
      {tips.map(([, t], i) => (
        <div key={`t${i}`} className="tip" dangerouslySetInnerHTML={{ __html: linkify(t) }} />
      ))}
      {(st.subs ?? []).map((sb, i) => (
        <div key={`sb${i}`}>
          <h3 style={{ marginTop: 26, fontSize: 20 }}>{sb.h}</h3>
          {sb.paras.map((p, k) => (
            <p key={k} dangerouslySetInnerHTML={{ __html: linkify(p) }} />
          ))}
        </div>
      ))}
      {mock ? (
        st.h === 'Grayscale images' ? (
          <div className="demo" role="img" aria-label="Example photo: left half converted to grayscale, right half in color" />
        ) : (
          <MockBlock k={mock[0]} q={mock[1]} adv={!!mock[2]} />
        )
      ) : null}
    </>
  )
}

export function GuideView({
  guide,
  slug,
  toolName,
}: {
  guide: Guide
  slug: string
  toolName: string
}) {
  if (!guide.steps.length) return null
  const words = guide.h.split(/(PDF)/)
  return (
    <div className="gw">
      <h2>
        {words.map((w, i) =>
          w === 'PDF' ? (
            <span key={i} className="serif">
              PDF
            </span>
          ) : (
            <span key={i}>{w}</span>
          ),
        )}
      </h2>
      {guide.sub ? <p className="sub">{guide.sub}</p> : <div style={{ height: 30 }} />}
      <ol className="st">
        {guide.steps.map((st, i) => (
          <li key={i} className={st.h ? undefined : 'np'}>
            <Step st={st} slug={slug} />
          </li>
        ))}
      </ol>
      {guide.cta ? (
        <p className="gcta">
          <b>{guide.cta}</b>
          <Link className="pill" href={`#thero`}>
            {toolName} online<b>›</b>
          </Link>
        </p>
      ) : null}
    </div>
  )
}
