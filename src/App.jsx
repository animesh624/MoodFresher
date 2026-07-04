import { useState, useMemo, useEffect } from 'react'
import './App.css'

import soyaChaapBiryani from './resources/SoyaChaap biryani.jpeg'
import premiumThali from './resources/Premium Thali.jpeg'
import mlaaiChaap from './resources/Mlaai Chaap.jpeg'
import menu3 from './resources/menu3.jpeg'
import menu2 from './resources/menu2.jpeg'
import menu1 from './resources/menu1.jpeg'
import manchurianNoodles from './resources/Manchurian Noodles.jpeg'
import manchurianFriedRice from './resources/Manchurian Fried Rice.jpeg'
import deluxThali from './resources/Delux Thaali.jpeg'
import chilliPaneerNoodle from './resources/Chilli Paneer Noodle.jpeg'
import chilliPaneerFriedRice from './resources/CHilli Paneer Fried Rice.jpeg'
import chaapButterMasalaRumali from './resources/Chaap Butter Msala RUmali Roti.jpeg'
import bahubaliThali from './resources/Bahubali Thali.jpeg'
import afgaaniChaap from './resources/Afgaani chaap.jpeg'
import achaariChaap from './resources/Achaari Chaap.jpeg'

const WHATSAPP_NUMBER = '918736066574' // your WhatsApp number (no +)

const MENU = [
  { id: 1, name: 'Soya Chaap Biryani', price: 160, desc: 'Soya chaap biryani - flavorful & aromatic', img: soyaChaapBiryani, category: 'Chaap Specials' },
  { id: 2, name: 'Paneer Butter Masala', price: 140, desc: 'Soft paneer cubes in rich creamy tomato gravy', img: menu1, category: 'Indian Gravy' },
  { id: 3, name: 'Veg Chowmein', price: 120, desc: 'Hakka style stir fried noodles with veggies', img: manchurianNoodles, category: 'Chinese' },
  { id: 4, name: 'Manchurian Fried Rice', price: 140, desc: 'Fried rice tossed with manchurian veg', img: manchurianFriedRice, category: 'Chinese' },
  { id: 5, name: 'Chilli Paneer Noodle', price: 150, desc: 'Spicy chilli paneer with noodles', img: chilliPaneerNoodle, category: 'Chinese' },
  { id: 6, name: 'Chilli Paneer Fried Rice', price: 150, desc: 'Chilli paneer served with fried rice', img: chilliPaneerFriedRice, category: 'Chinese' },
  { id: 7, name: 'Achaari Chaap', price: 180, desc: 'Achaari marinated chaap, grilled to perfection', img: achaariChaap, category: 'Chaap Specials' },
  { id: 8, name: 'Afgaani Chaap', price: 200, desc: 'Afgaani style chaap with rich flavours', img: afgaaniChaap, category: 'Chaap Specials' },
  { id: 9, name: 'Chaap Butter Masala + Rumali Roti', price: 220, desc: 'Chaap butter masala served with rumali roti', img: chaapButterMasalaRumali, category: 'Chaap Specials' },
  { id: 10, name: 'Bahubali Thali', price: 320, desc: 'Hearty thali with multiple dishes', img: bahubaliThali, category: 'Thali' },
  { id: 11, name: 'Delux Thali', price: 260, desc: 'Deluxe thali for a complete meal', img: deluxThali, category: 'Thali' },
  { id: 12, name: 'Premium Thali', price: 300, desc: 'Premium thali with special dishes', img: premiumThali, category: 'Thali' },
  { id: 13, name: 'Mlaai Chaap', price: 200, desc: 'Creamy malai chaap', img: mlaaiChaap, category: 'Chaap Specials' },
]

const CATEGORIES = ['All', 'Chinese', 'Chaap Specials', 'Thali', 'Indian Gravy', 'Combos', 'Momos']

function App() {
  const [quantities, setQuantities] = useState(() => MENU.reduce((acc, it) => ({ ...acc, [it.id]: 0 }), {}))
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState('')
  const [instructions, setInstructions] = useState('')
  const [activeCat, setActiveCat] = useState('All')
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState('menu') // 'menu' | 'contact' | 'about'
  const [carouselIdx, setCarouselIdx] = useState(0)

  // Navigation helpers: sync view with URL so Contact opens as a new page (pushState)
  const navigate = (newView) => {
    setView(newView)
    const path = newView === 'menu' ? '/' : `/${newView}`
    try { window.history.pushState({ view: newView }, '', path) } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    // Initialize view from current URL
    const p = window.location.pathname.replace(/\/$/, '')
    if (p === '' || p === '/') setView('menu')
    else if (p.includes('contact')) setView('contact')
    else if (p.includes('about')) setView('about')
    else setView('menu')

    const onPop = (e) => {
      const state = (e.state && e.state.view) || window.location.pathname.replace(/\/$/, '')
      if (state === '' || state === '/' ) setView('menu')
      else if (typeof state === 'string' && state.includes('contact')) setView('contact')
      else if (typeof state === 'string' && state.includes('about')) setView('about')
      else setView('menu')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const inc = (id) => setQuantities(q => ({ ...q, [id]: (q[id] || 0) + 1 }))
  const dec = (id) => setQuantities(q => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }))
  const setQty = (id, val) => setQuantities(q => ({ ...q, [id]: Math.max(0, Number(val) || 0) }))

  const visibleMenu = useMemo(() => MENU.filter(m => activeCat === 'All' || m.category === activeCat), [activeCat])

  const orderLines = MENU.map(item => {
    const qty = quantities[item.id] || 0
    return { ...item, qty, lineTotal: qty * item.price }
  }).filter(x => x.qty > 0)

  const subtotal = orderLines.reduce((s, it) => s + it.lineTotal, 0)
  const delivery = subtotal > 0 ? 20 : 0
  const total = subtotal + delivery

  const canPlace = name.trim() !== '' && address.trim() !== '' && mobile.trim() !== '' && subtotal > 0 && WHATSAPP_NUMBER

  const placeOrder = () => {
    if (!canPlace) {
      alert('Please enter name, address and select at least one item before placing the order.')
      return
    }

    let msg = `Mood Fresher - New order from website\nName: ${name}\nMobile: ${mobile}\nAddress: ${address}\n\nItems:\n`
    orderLines.forEach(it => { msg += `${it.name} x ${it.qty} = ₹${it.lineTotal}\n` })
    msg += `\nSubtotal: ₹${subtotal}\nDelivery: ₹${delivery}\nTotal: ₹${total}`
    if (instructions && instructions.trim()) {
      msg += `\n\nInstructions: ${instructions.trim()}`
    }

    const encoded = encodeURIComponent(msg)
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`
    window.open(waLink, '_blank')
  }

  const cartCount = orderLines.reduce((s, it) => s + it.qty, 0)

  useEffect(() => {
    document.title = 'MoodFresher — Cafe & Restaurant'
  }, [])

  // Auto-scroll carousel every 8 seconds (slowed down)
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % 3)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="app-root">
      <header className="topbar">
        <button className="hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
        <div className="brand">
          <div className="logo">Mood<br/>Fresher</div>
          <div className="tag">Cafe & Restaurant</div>
        </div>
        <div className="top-actions">
          <button className="wa-btn" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>ORDER ON WHATSAPP</button>
          <div className="cart" title="Cart">🛒<span className="cart-count">{cartCount}</span></div>
        </div>
      </header>

      {/* Navigation drawer */}
      <div className={"nav-drawer" + (navOpen ? ' open' : '')} onClick={() => setNavOpen(false)}>
        <nav className="nav-inner" onClick={e => e.stopPropagation()}>
          <button className="nav-close" onClick={() => setNavOpen(false)}>✕</button>
          <ul>
            <li><button onClick={() => { navigate('menu'); setNavOpen(false); }}>Menu</button></li>
            <li><button onClick={() => { navigate('contact'); setNavOpen(false); }}>Contact</button></li>
            <li><button onClick={() => { navigate('about'); setNavOpen(false); }}>About</button></li>
          </ul>
        </nav>
      </div>

      <section className="hero-banner">
        <h2>Delicious Food, Delivered Fresh!</h2>
        <p>Order Direct & Save More</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => { const el = document.querySelector('.menu-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>Explore our menu</button>
          <button className="secondary" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>Call / WhatsApp</button>
        </div>
      </section>

      <section className="info-section">
        <div className="carousel-wrapper">
          <div className="carousel-items" style={{ transform: `translateX(-${carouselIdx * 100}%)` }}>
            <div className="info-card carousel-item">
              <h4>💰 Best Prices</h4>
              <p>Order direct and save more — no middlemen.</p>
            </div>
            <div className="info-card carousel-item">
              <h4>🍳 Freshly Prepared</h4>
              <p>Made to order with fresh ingredients.</p>
            </div>
            <div className="info-card carousel-item">
              <h4>🚗 Fast Delivery</h4>
              <p>Typical delivery time 30–45 minutes.</p>
            </div>
          </div>
          <div className="carousel-dots">
            {[0, 1, 2].map(i => (
              <button key={i} className={`dot ${i === carouselIdx ? 'active' : ''}`} onClick={() => setCarouselIdx(i)}></button>
            ))}
          </div>
        </div>
      </section>

      {view === 'menu' && (
        <div className="category-row">
          {CATEGORIES.map(cat => (
            <button key={cat} className={cat === activeCat ? 'cat active' : 'cat'} onClick={() => setActiveCat(cat)}>{cat}</button>
          ))}
        </div>
      )}

      {view === 'menu' ? (
        <main className="content">
          <section className="menu-section">
            <h3>Explore our menu</h3>
            <div className="menu-grid">
              {visibleMenu.map(item => (
                <article className="menu-card" key={item.id}>
                  <div className="food-img" aria-hidden style={{ backgroundImage: item.img ? `url(${item.img})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                  <div className="menu-info">
                    <div>
                      <div className="menu-title">{item.name}</div>
                      <div className="menu-desc">{item.desc}</div>
                    </div>
                    <div className="menu-footer">
                      <div className="price">₹{item.price}</div>
                      <div className="qty-controls">
                        <button className="small" onClick={() => dec(item.id)}>-</button>
                        <input value={quantities[item.id] || 0} onChange={e => setQty(item.id, e.target.value)} />
                        <button className="small" onClick={() => inc(item.id)}>+</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="order-panel">
            <h4>Order summary</h4>
            {orderLines.length === 0 ? <div className="empty">No items selected</div> : (
              <div>
                <ul className="order-lines">
                  {orderLines.map(it => (
                    <li key={it.id}><span>{it.name} x {it.qty}</span><strong>₹{it.lineTotal}</strong></li>
                  ))}
                </ul>
                <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
                <div className="summary-row"><span>Delivery</span><span>₹{delivery}</span></div>
                <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
              </div>
            )}

            <div className="cust-inputs">
              <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
              <input placeholder="Mobile number" value={mobile} onChange={e => setMobile(e.target.value)} style={{marginTop:8}} />
              <textarea placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} rows={3} />
              <textarea placeholder="Delivery instructions (optional)" value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} />
            </div>

            <button className={`place-btn ${canPlace ? 'enabled' : 'disabled'}`} onClick={placeOrder} disabled={!canPlace}>Place order via WhatsApp</button>
          </aside>
        </main>
      ) : view === 'contact' ? (
        <main className="content contact-page">
          <section style={{flex:1, padding:20}}>
            <h3>Contact Us</h3>
            <p style={{color:'var(--muted)'}}>Have a question or want to place a large/bulk order? Reach out using the details below or message us on WhatsApp.</p>

            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12,marginTop:12}}>
              <div style={{background:'rgba(255,255,255,0.02)',padding:12,borderRadius:8}}>Phone: <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">+91 {WHATSAPP_NUMBER.slice(2)}</a></div>
              <div style={{background:'rgba(255,255,255,0.02)',padding:12,borderRadius:8}}>Address: 27/17 Elgin Road, Civil Lines, Prayagraj, Uttar Pradesh</div>
              <div style={{background:'rgba(255,255,255,0.02)',padding:12,borderRadius:8}}>Email: moodfresher@example.com</div>
            </div>

            <h4 style={{marginTop:18}}>Opening Hours</h4>
            <table style={{width:'100%',marginTop:8}}>
              <tbody>
                <tr><td style={{color:'var(--muted)'}}>Mon–Fri</td><td>10:00 — 22:00</td></tr>
                <tr><td style={{color:'var(--muted)'}}>Sat–Sun</td><td>10:00 — 23:00</td></tr>
              </tbody>
            </table>

            <div style={{marginTop:18}}>
              <h4>Bulk & Catering</h4>
              <p style={{color:'var(--muted)'}}>We accept orders for parties & marriages. Bulk orders starting from 50+ plates — message us for a quote.</p>
            </div>

          </section>

          <aside className="order-panel">
            <h4>Quick Contact</h4>
            <p style={{color:'var(--muted)',marginTop:6}}>Send a WhatsApp message with your query</p>
            <button className="place-btn enabled" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello, I would like to enquire about...')}`, '_blank')}>Message on WhatsApp</button>
          </aside>
        </main>
      ) : (
        <main className="content contact-page"><div style={{padding:20}}>About MoodFresher — Delicious food delivered fresh. <br/>Made with love.</div></main>
      )
      }

      {view === 'menu' && cartCount > 0 && (
        <div className="bottom-bar">
          <div className="left">{cartCount} items • ₹{total}</div>
          <button className="place" onClick={placeOrder} disabled={!canPlace}>{canPlace ? 'Place order on WhatsApp' : 'Enter details to order'}</button>
        </div>
      )}

    </div>
  )
}

export default App
