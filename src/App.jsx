import { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import './App.css'
import './Admin.css' // Import admin dashboard styles

import brandLogo from './resources/Logo.jpeg'

const RESTAURANT_LAT = 25.454407962816024
const RESTAURANT_LNG = 81.84513313772787

const FREE_DELIVERY_KM = 3
const DELIVERY_CHARGE_PER_KM = 10
const ROAD_DISTANCE_MULTIPLIER = 1.4

const DISCOUNT_TIERS = [
  { minAmount: 300, discountPercent: 10, label: '10% OFF', emoji: '🔥' },
  { minAmount: 500, discountPercent: 15, label: '15% OFF', emoji: '⚡' },
  { minAmount: 800, discountPercent: 20, label: '20% OFF', emoji: '💥' },
]

const menuImages = import.meta.glob('./resources/*.jpeg', { eager: true, query: '?url', import: 'default' })

const photoMap = {}
for (const [path, module] of Object.entries(menuImages)) {
  const filename = path.replace('./resources/', '')
  if (filename !== 'Logo.jpeg') {
    photoMap[filename] = module
  }
}

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const calcDeliveryCharge = (distanceKm) => {
  if (distanceKm == null || distanceKm <= 0) return 0
  if (distanceKm <= FREE_DELIVERY_KM) return 0
  const extraKm = Math.round(distanceKm - FREE_DELIVERY_KM)
  if (extraKm <= 0) return 0
  return extraKm * DELIVERY_CHARGE_PER_KM
}

const formatTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

const getClosedDaysList = (openDays) => {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const closedDays = allDays.filter(d => !openDays.includes(d))
  const dayLabels = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
  }
  return closedDays.map(d => dayLabels[d] || d)
}

const getClosureMessage = (shopOpen, config) => {
  if (!config) return null;
  const openTimeFormatted = formatTime(config.openTime)
  const closeTimeFormatted = formatTime(config.closeTime)
  if (!shopOpen) {
    return {
      icon: '🔒',
      title: 'Currently Offline',
      detail: "We're temporarily unavailable. Thank you for your patience. Please reach out to us via WhatsApp to enquire or pre-order."
    }
  }
  if (!config.enabled) return null
  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const isOperatingDay = config.days.includes(dayName)
  if (!isOperatingDay) {
    const closedList = getClosedDaysList(config.days)
    return {
      icon: '😴',
      title: `Closed on ${closedList.join(', ')}`,
      detail: closedList.includes(dayName.slice(0, 3))
        ? `We're closed today (${dayName}). Our operating hours are ${openTimeFormatted} - ${closeTimeFormatted}. See you on our next working day!`
        : `We're open ${openTimeFormatted} - ${closeTimeFormatted}. We're closed on ${closedList.join(', ')}.`
    }
  } else {
    return {
      icon: '⏰',
      title: "Not Open Yet",
      detail: `Our kitchen opens at ${openTimeFormatted} and closes at ${closeTimeFormatted}. Please visit us during operating hours.`
    }
  }
}

// Calculate discount info from subtotal
const getDiscountInfo = (subtotal) => {
  let activeTier = null
  for (const tier of DISCOUNT_TIERS) {
    if (subtotal >= tier.minAmount) {
      activeTier = tier
    }
  }
  if (!activeTier) return { tier: null, discountPercent: 0, discountAmount: 0 }

  const discountPercent = activeTier.discountPercent
  const discountAmount = Math.round((subtotal * discountPercent) / 100)
  return { tier: activeTier, discountPercent, discountAmount }
}

// Find next tier the user is aiming for
const getNextTier = (subtotal) => {
  for (const tier of DISCOUNT_TIERS) {
    if (subtotal < tier.minAmount) return tier
  }
  return null
}

const getDiscountProgress = (subtotal, minOrder) => {
  const maxTier = DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minAmount
  const range = maxTier - minOrder
  if (subtotal >= maxTier) return 100
  if (subtotal <= minOrder) return 0
  return Math.min(100, ((subtotal - minOrder) / range) * 100)
}

const CATEGORY_IMAGES = {
  'All': brandLogo,
  'Thali': photoMap['Bahubali Thali.jpeg'],
  'Chinese Combos': photoMap['Manchurian Fried Rice.jpeg'],
  'Indian Combos': photoMap['Chaap Butter Msala RUmali Roti.jpeg'],
  'Chauchak Chaap': photoMap['Achaari Chaap.jpeg'],
  'Tagda Tikka': photoMap['Paneer Tikka.jpeg'],
  'Chaap Specials': photoMap['SoyaChaap biryani.jpeg'],
  'Mazedaar Momo': photoMap['steamed_momos.jpeg'],
  'Raapchik Rolls': photoMap['spring_roll.jpeg'],
  'Chinese': photoMap['Manchurian Noodles.jpeg'],
  'Rice Bowls': photoMap['Dal Rice Bowl.jpeg'],
  'Desert': photoMap['Gulab Jamun.jpeg'],
  'Indian Gravy': photoMap['Paneer Butter Masala.jpeg'],
  'Dal': photoMap['Dal Tadka.jpeg'],
  'Rice': photoMap['Jeera Rice.jpeg'],
  'Breads': photoMap['Chaap Butter Msala RUmali Roti.jpeg'],
  'Waffle Hut': photoMap['Triple Chocolate Premium.jpeg']
}

/* ── Toast System ── */
const ToastContext = createContext(null)
function useToast() { return useContext(ToastContext) }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)
  const addToast = useCallback((type, message) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev.slice(-2), { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2000)
  }, [])
  const contextValue = useMemo(() => ({
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg),
    info: (msg) => addToast('info', msg),
  }), [addToast])
  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-container" style={{ zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ── Main App Content ── */
function AppContent() {
  const toast = useToast()

  // Dynamic backend states
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState(null)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  // Customer states
  const [quantities, setQuantities] = useState({})
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState('')
  const [instructions, setInstructions] = useState('')
  const [location, setLocation] = useState(null)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [deliveryDistance, setDeliveryDistance] = useState(null)
  const [activeCat, setActiveCat] = useState('All')
  const [navOpen, setNavOpen] = useState(false)
  // --- Synchronously detect admin order deep-link BEFORE first render ---
  const [view, setView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const adminOrder = params.get('admin_order')
      const token = localStorage.getItem('adminToken')
      console.log('%c[MF Step 4] React SPA init - view state', 'color:#d4a24c;font-weight:bold',
        '| URL:', window.location.href,
        '| admin_order param:', adminOrder,
        '| adminToken in LS:', token ? 'YES (len=' + token.length + ')' : 'NO'
      )
      if (adminOrder && token) {
        console.log('%c[MF Step 4] -> Initializing as ADMIN view', 'color:#4ade80;font-weight:bold')
        return 'admin'
      }
      console.log('%c[MF Step 4] -> Initializing as MENU view', 'color:#a0a0b8;font-weight:bold')
    } catch (e) {
      console.error('[MF] view initializer error:', e)
    }
    return 'menu'
  })
  const [exploreMenu, setExploreMenu] = useState(false)
  const [celebratedTier, setCelebratedTier] = useState(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [expandedSubcats, setExpandedSubcats] = useState({})
  const orderPanelRef = useRef(null)
  const catRowRef = useRef(null)
  const prevTierRef = useRef(null)

  // Customer Coupon States
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [cartLoaded, setCartLoaded] = useState(false)

  // Admin states
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('adminToken') || null)
  const [adminView, setAdminView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const adminOrder = params.get('admin_order')
      const token = localStorage.getItem('adminToken')
      console.log('%c[MF Step 5] React SPA init - adminView state', 'color:#d4a24c;font-weight:bold',
        '| admin_order:', adminOrder, '| has token:', !!token
      )
      if (adminOrder && token) {
        console.log('%c[MF Step 5] -> Initializing adminView as ORDERS', 'color:#4ade80;font-weight:bold')
        return 'orders'
      }
    } catch (e) {
      console.error('[MF] adminView initializer error:', e)
    }
    return 'dashboard'
  })
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  
  // Admin entities lists
  const [adminCoupons, setAdminCoupons] = useState([])
  const [adminBanners, setAdminBanners] = useState([])
  const [adminOrders, setAdminOrders] = useState([])
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false)
  const [selectedAdminOrder, setSelectedAdminOrder] = useState(null)

  // Admin Item Edit/Create Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null) // null for create
  const [itemForm, setItemForm] = useState({
    itemName: '', category: '', subcategory: '', photoName: '', description: '',
    price: '', priceHalf: '', priceFull: '', hasHalfFull: false, isAvailable: true,
    weight: '', breakdown: '', originalPrice: '', originalPriceHalf: '', originalPriceFull: ''
  })
  const [itemSearch, setItemSearch] = useState('')

  // Admin Coupon Modal states
  const [couponModalOpen, setCouponModalOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [couponForm, setCouponForm] = useState({
    code: '', discountPercent: '', minAmount: '', description: '', isActive: true
  })

  // Admin Banner Modal states
  const [bannerModalOpen, setBannerModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState(null)
  const [bannerForm, setBannerForm] = useState({
    title: '', description: '', image: '', couponCode: '', isActive: true
  })

  // Change Password Form
  const [passForm, setPassForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })

  // Determine if restaurant is currently open
  const isShopOperating = useCallback((settingsDoc) => {
    if (!settingsDoc) return false
    if (!settingsDoc.shopOpen) return false
    const config = settingsDoc.operatingHours
    if (!config || !config.enabled) return true
    const now = new Date()
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
    return config.days.includes(dayName) && currentTime >= config.openTime && currentTime < config.closeTime
  }, [])

  const isOpen = useMemo(() => isShopOperating(settings), [settings, isShopOperating])

  // Get active WhatsApp number
  const whatsappNumber = settings?.whatsappNumber || import.meta.env.VITE_WHATSAPP_NUMBER || '918736066574'
  const minOrderAmount = settings?.minOrderAmount || 200
  const maxDeliveryDistance = settings?.maxDeliveryDistance || 8

  // Fetch initial data
  const fetchData = async () => {
    try {
      let sid = localStorage.getItem('sessionId')
      if (!sid) {
        sid = 'mf_session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('sessionId', sid)
      }
      setSessionId(sid)

      const [itemsRes, settingsRes, bannersRes, cartRes] = await Promise.all([
        fetch('/api/items').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/banners').then(r => r.json()),
        fetch(`/api/cart/${sid}`).then(r => r.json())
      ])

      setItems(itemsRes)
      setSettings(settingsRes)
      setBanners(bannersRes)

      // Initialize quantities
      const q = {}
      itemsRes.forEach(item => {
        if (item.hasHalfFull) {
          q[`${item.id}_half`] = 0
          q[`${item.id}_full`] = 0
        } else {
          q[`${item.id}`] = 0
        }
      })

      // Map saved cart from backend
      if (cartRes && cartRes.items) {
        cartRes.items.forEach(cItem => {
          if (q[cItem.key] !== undefined) {
            q[cItem.key] = cItem.qty
          }
        })
      }
      setQuantities(q)

      // Auto apply coupon if present in DB cart
      if (cartRes && cartRes.couponCode) {
        setCouponCode(cartRes.couponCode)
        try {
          const tempLines = []
          for (const [key, qty] of Object.entries(q)) {
            if (!qty || qty <= 0) continue
            const [idStr, variant] = key.includes('_') ? key.split('_') : [key, null]
            const id = parseInt(idStr)
            const item = itemsRes.find(m => m.id === id)
            if (item) {
              const displayPrice = variant === 'half' ? item.priceHalf : (variant === 'full' ? item.priceFull : item.price)
              tempLines.push({ qty, displayPrice })
            }
          }
          const tempSubtotal = tempLines.reduce((s, it) => s + (it.qty * it.displayPrice), 0)

          const cRes = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: cartRes.couponCode, subtotal: tempSubtotal })
          })
          const cData = await cRes.json()
          if (cRes.ok && cData.valid) {
            setAppliedCoupon(cData)
          }
        } catch (err) {
          console.error(err)
        }
      }

      setCartLoaded(true)
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load menu data from backend. Please refresh.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Handle admin order deep-link: ?admin_order=ORDER_ID
  // NOTE: view, adminToken, adminView are already initialized synchronously above.
  // This effect only handles URL cleanup + fetching the specific order to open.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const adminOrderId = params.get('admin_order')
    console.log('%c[MF Step 6] Deep-link useEffect fired', 'color:#d4a24c;font-weight:bold',
      '| admin_order:', adminOrderId,
      '| current URL:', window.location.href
    )
    if (!adminOrderId) {
      console.log('[MF Step 6] No admin_order param, skipping deep-link logic')
      return
    }

    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname)
    console.log('[MF Step 6] URL cleaned to:', window.location.pathname)

    const storedToken = localStorage.getItem('adminToken')
    console.log('[MF Step 6] storedToken from localStorage:', storedToken ? 'FOUND (len=' + storedToken.length + ')' : 'NOT FOUND')
    if (!storedToken) return

    // Fetch orders and open the specific order modal
    const loadAndFocusOrder = async () => {
      console.log('%c[MF Step 7] Fetching /api/orders...', 'color:#d4a24c;font-weight:bold')
      try {
        const res = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        })
        console.log('[MF Step 7] /api/orders response status:', res.status, res.statusText)
        if (!res.ok) {
          console.error('[MF Step 7] Token rejected or error! Clearing adminToken and going to menu.')
          localStorage.removeItem('adminToken')
          setAdminToken(null)
          setView('menu')
          return
        }
        const orders = await res.json()
        console.log('[MF Step 7] Orders fetched:', Array.isArray(orders) ? orders.length : 'NOT ARRAY', 'orders')
        setAdminOrders(Array.isArray(orders) ? orders : [])
        const target = Array.isArray(orders) ? orders.find(o => o.orderId === adminOrderId) : null
        console.log('[MF Step 7] Looking for orderId:', adminOrderId, '| Found:', target ? 'YES ✅' : 'NO ❌')
        if (!target) {
          console.log('[MF Step 7] Available orderIds:', Array.isArray(orders) ? orders.map(o => o.orderId) : [])
        }
        if (target) setSelectedAdminOrder(target)
      } catch (err) {
        console.error('[MF Step 7] fetch error:', err)
      }
    }
    loadAndFocusOrder()
  }, [])


  // Sync cart changes to MongoDB database with 500ms debounce
  useEffect(() => {
    if (!cartLoaded || !sessionId) return

    const delayDebounceFn = setTimeout(async () => {
      const itemsToSync = []
      for (const [key, qty] of Object.entries(quantities)) {
        if (qty > 0) {
          itemsToSync.push({ key, qty })
        }
      }

      try {
        await fetch(`/api/cart/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsToSync,
            couponCode: appliedCoupon ? appliedCoupon.code : ''
          })
        })
      } catch (err) {
        console.error('Cart sync error:', err)
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [quantities, appliedCoupon, cartLoaded, sessionId])

  // Verify Admin Token on load
  useEffect(() => {
    if (adminToken) {
      console.log('%c[MF Verify] Checking token validity...', 'color:#d4a24c;font-weight:bold')
      fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      .then(res => {
        console.log('[MF Verify] /api/auth/verify response:', res.status, res.statusText)
        if (res.status === 401) {
          // Only clear token on explicit 401 Unauthorized (token is genuinely invalid/expired)
          console.warn('[MF Verify] Token is invalid (401) - clearing token and going to login')
          localStorage.removeItem('adminToken')
          setAdminToken(null)
        } else if (!res.ok) {
          // Server error (500, cold start, etc.) - DO NOT clear token, may be transient
          console.warn('[MF Verify] Server error during verify (' + res.status + ') - keeping token (may be cold start)')
        } else {
          console.log('%c[MF Verify] Token is VALID ✅', 'color:#4ade80;font-weight:bold')
        }
      })
      .catch((err) => {
        // Network error (offline, timeout, Vercel cold start) - DO NOT clear token
        // The token proved valid when /api/orders returned 200, so this is a transient error
        console.warn('[MF Verify] Network error during verify - keeping token (likely transient):', err.message)
      })
    }
  }, [adminToken])


  // Fetch Admin Specific Data
  const fetchAdminData = async () => {
    if (!adminToken) return
    setAdminOrdersLoading(true)
    try {
      const [couponsRes, bannersRes, ordersRes] = await Promise.all([
        fetch('/api/coupons', { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/banners/all', { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/orders', { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json())
      ])
      setAdminCoupons(Array.isArray(couponsRes) ? couponsRes : [])
      setAdminBanners(Array.isArray(bannersRes) ? bannersRes : [])
      setAdminOrders(Array.isArray(ordersRes) ? ordersRes : [])
    } catch (err) {
      console.error(err)
    } finally {
      setAdminOrdersLoading(false)
    }
  }

  useEffect(() => {
    if (adminToken && view === 'admin') {
      fetchAdminData()
    }
  }, [adminToken, view])

  // Process item structure for consumer consumption
  const MENU = useMemo(() => {
    const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'
    return items.map(item => {
      let imageSrc = DEFAULT_FOOD_IMAGE
      if (item.photoName) {
        if (item.photoName.startsWith('http://') || item.photoName.startsWith('https://')) {
          imageSrc = item.photoName
        } else if (photoMap[item.photoName]) {
          imageSrc = photoMap[item.photoName]
        }
      }
      return {
        id: item.id,
        name: item.itemName,
        price: item.price ?? item.priceFull ?? item.priceHalf ?? 0,
        priceHalf: item.priceHalf ?? null,
        priceFull: item.priceFull ?? null,
        hasHalfFull: !!(item.priceHalf != null && item.priceFull != null),
        desc: item.description,
        img: imageSrc,
        category: item.category,
        subcategory: item.subcategory,
        isAvailable: item.isAvailable !== false,
        weight: item.weight || '',
        breakdown: item.breakdown || '',
        originalPrice: item.originalPrice ?? null,
        originalPriceHalf: item.originalPriceHalf ?? null,
        originalPriceFull: item.originalPriceFull ?? null
      }
    })
  }, [items])

  // Process categories dynamically
  const CATEGORIES = useMemo(() => {
    const cats = new Set(items.map(it => it.category))
    const list = Array.from(cats).filter(c => c !== 'All')
    const standardOrder = [
      "Thali", "Chinese Combos", "Indian Combos", "Chauchak Chaap", "Tagda Tikka",
      "Chaap Specials", "Mazedaar Momo", "Raapchik Rolls", "Chinese", "Rice Bowls",
      "Desert", "Indian Gravy", "Dal", "Rice", "Breads", "Waffle Hut"
    ]
    list.sort((a, b) => {
      const idxA = standardOrder.indexOf(a)
      const idxB = standardOrder.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })
    return ['All', ...list]
  }, [items])

  // Helpers to get image source for custom dynamically-added categories
  const getCategoryImage = (category) => {
    if (CATEGORY_IMAGES[category]) return CATEGORY_IMAGES[category]
    // Fallback to first item's photoName/URL in that category
    const catItem = items.find(it => it.category === category && it.photoName)
    if (catItem) {
      return photoMap[catItem.photoName] || catItem.photoName
    }
    return brandLogo
  }

  // Routing code
  const navigate = (newView) => {
    setView(newView)
    const path = newView === 'menu' ? '/' : `/${newView}`
    try { window.history.pushState({ view: newView }, '', path) } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    const p = window.location.pathname.replace(/\/$/, '')
    if (p === '' || p === '/') setView('menu')
    else if (p.includes('contact')) setView('contact')
    else if (p.includes('about')) setView('about')
    else if (p.includes('admin')) setView('admin')
    else setView('menu')

    const onPop = (e) => {
      const state = (e.state && e.state.view) || window.location.pathname.replace(/\/$/, '')
      if (state === '' || state === '/' ) setView('menu')
      else if (typeof state === 'string' && state.includes('contact')) setView('contact')
      else if (typeof state === 'string' && state.includes('about')) setView('about')
      else if (typeof state === 'string' && state.includes('admin')) setView('admin')
      else setView('menu')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const inc = (key) => setQuantities(q => ({ ...q, [key]: (q[key] || 0) + 1 }))
  const dec = (key) => setQuantities(q => ({ ...q, [key]: Math.max(0, (q[key] || 0) - 1) }))

  const visibleMenu = useMemo(() => {
    const filtered = MENU.filter(m => (activeCat === 'All' || m.category === activeCat) && m.isAvailable)
    if (activeCat === 'All') {
      return [...filtered].sort((a, b) => {
        if (a.category === 'Thali' && b.category !== 'Thali') return -1
        if (a.category !== 'Thali' && b.category === 'Thali') return 1
        return 0
      })
    }
    return filtered
  }, [activeCat, MENU])

  const resolveItem = useCallback((key) => {
    const [idStr, variant] = key.includes('_') ? key.split('_') : [key, null]
    const id = parseInt(idStr)
    const item = MENU.find(m => m.id === id)
    if (!item) return null
    if (variant === 'half' && item.hasHalfFull) {
      return { ...item, displayPrice: item.priceHalf, displayName: `${item.name} (Half)`, badge: 'Half' }
    }
    if (variant === 'full' && item.hasHalfFull) {
      return { ...item, displayPrice: item.priceFull, displayName: `${item.name} (Full)`, badge: 'Full' }
    }
    return { ...item, displayPrice: item.price, displayName: item.name, badge: '' }
  }, [MENU])

  const orderLines = useMemo(() => {
    const lines = []
    for (const [key, qty] of Object.entries(quantities)) {
      if (!qty || qty <= 0) continue
      const info = resolveItem(key)
      if (info) {
        lines.push({ ...info, qty, lineTotal: qty * info.displayPrice })
      }
    }
    return lines
  }, [quantities, resolveItem])

  const subtotal = orderLines.reduce((s, it) => s + it.lineTotal, 0)
  const deliveryCharge = deliveryDistance != null ? calcDeliveryCharge(deliveryDistance) : 0

  // Discount calculations (supports coupon override or progress tiers fallback)
  const discountInfo = useMemo(() => {
    if (appliedCoupon) {
      if (subtotal < appliedCoupon.minAmount) {
        // Subtotal dropped below coupon requirement
        return { percent: 0, amount: 0, type: 'coupon-invalidated' }
      }
      const amount = Math.round((subtotal * appliedCoupon.discountPercent) / 100)
      return { percent: appliedCoupon.discountPercent, amount, type: 'coupon', label: `${appliedCoupon.discountPercent}% OFF` }
    }
    
    // Fall back to standard progressive discount tiers
    const tierInfo = getDiscountInfo(subtotal)
    return {
      percent: tierInfo.discountPercent,
      amount: tierInfo.discountAmount,
      type: 'tier',
      label: tierInfo.tier?.label || null,
      tier: tierInfo.tier
    }
  }, [subtotal, appliedCoupon])

  const discountPercent = discountInfo.percent
  const discountAmount = discountInfo.amount
  const activeTier = discountInfo.type === 'tier' ? discountInfo.tier : null

  // Invalidate coupon if subtotal falls below requirement
  useEffect(() => {
    if (appliedCoupon && subtotal < appliedCoupon.minAmount) {
      setAppliedCoupon(null)
      setCouponError(`Coupon "${appliedCoupon.code}" removed. Min amount ₹${appliedCoupon.minAmount} required.`)
      toast.error(`Coupon removed: requires subtotal of ₹${appliedCoupon.minAmount}`)
    }
  }, [subtotal, appliedCoupon, toast])

  const nextTier = getNextTier(subtotal)
  const discountProgress = getDiscountProgress(subtotal, minOrderAmount)
  const meetsMinOrder = subtotal >= minOrderAmount
  const shortfallMin = Math.max(0, minOrderAmount - subtotal)
  const shortfallNext = nextTier ? Math.max(0, nextTier.minAmount - subtotal) : 0

  const totalBeforeDiscount = subtotal + deliveryCharge
  const total = Math.max(0, totalBeforeDiscount - discountAmount)

  const isDeliverable = deliveryDistance == null || deliveryDistance <= maxDeliveryDistance
  const canPlace = name.trim() !== '' && address.trim() !== '' && mobile.trim() !== '' && subtotal > 0 && whatsappNumber && isOpen && meetsMinOrder && isDeliverable && location !== null

  // Trigger celebrated tier popups
  useEffect(() => {
    const currentTierKey = activeTier ? activeTier.minAmount : 0
    if (currentTierKey !== prevTierRef.current) {
      if (currentTierKey > 0 && (prevTierRef.current === null || currentTierKey > prevTierRef.current)) {
        setCelebratedTier(activeTier)
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 6000)
      }
      prevTierRef.current = currentTierKey
    }
  }, [activeTier, subtotal])

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const dist = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng)
        setDeliveryDistance(dist * ROAD_DISTANCE_MULTIPLIER)
        setLocation(`https://maps.google.com/?q=${lat},${lng}`)
        setLocating(false)
        toast.success('Location shared successfully!')
      },
      (err) => {
        toast.error('Could not get your location. Please enable location access and try again.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const scrollToOrderPanel = () => {
    if (orderPanelRef.current) {
      orderPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Handle Coupon Apply
  const applyCoupon = async (e) => {
    if (e) e.preventDefault()
    if (!couponCode.trim()) return
    setCouponError('')
    
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), subtotal })
      })
      const data = await res.json()

      if (res.ok && data.valid) {
        setAppliedCoupon(data)
        toast.success(`Coupon "${data.code}" applied successfully!`)
      } else {
        setCouponError(data.message || 'Invalid coupon code')
        toast.error(data.message || 'Coupon code invalid')
      }
    } catch (err) {
      console.error(err)
      setCouponError('Network error validating coupon')
    }
  }

  // Auto apply coupon from banners
  const autoApplyCoupon = async (code) => {
    setCouponCode(code)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setAppliedCoupon(data)
        setCouponError('')
        toast.success(`Coupon "${data.code}" auto-applied!`)
      } else {
        setCouponError(data.message || 'Coupon conditions not met')
        toast.error(data.message || 'Coupon not applicable')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    toast.info('Coupon removed')
  }

  const generateInvoiceCanvas = (orderId, orderDetails) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      // 1. Draw Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Card Container outline
      ctx.strokeStyle = '#d4a24c';
      ctx.lineWidth = 2;
      ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

      // Inner Card fills
      ctx.fillStyle = '#14141e';
      ctx.fillRect(30, 30, canvas.width - 60, 940);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, canvas.width - 60, 940);

      // Header Brand
      ctx.fillStyle = '#f0c86a';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MoodFresher', canvas.width / 2, 85);

      ctx.fillStyle = '#6b6b82';
      ctx.font = '14px sans-serif';
      ctx.fillText('100% PURE VEGETARIAN CAFE & RESTAURANT', canvas.width / 2, 115);

      // Divider
      ctx.strokeStyle = 'rgba(212, 162, 76, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 135);
      ctx.lineTo(canvas.width - 50, 135);
      ctx.stroke();

      // Details Left Aligned
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f1f1f7';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`ORDER ID: ${orderId}`, 60, 180);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#a0a0b8';
      ctx.fillText(`Date: ${new Date().toLocaleString()}`, 60, 210);
      ctx.fillText(`Customer Name: ${orderDetails.customerName}`, 60, 240);
      ctx.fillText(`Mobile: ${orderDetails.customerMobile}`, 60, 270);
      
      // Wrap Address Text
      ctx.fillText('Delivery Address:', 60, 300);
      ctx.fillStyle = '#f1f1f7';
      const addressWords = orderDetails.customerAddress.split(' ');
      let addressLine = '';
      let addressY = 325;
      addressWords.forEach(word => {
        const testLine = addressLine + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 680) {
          ctx.fillText(addressLine, 60, addressY);
          addressLine = word + ' ';
          addressY += 22;
        } else {
          addressLine = testLine;
        }
      });
      ctx.fillText(addressLine, 60, addressY);

      // Table Header Y starts after address
      let tableY = addressY + 40;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, tableY);
      ctx.lineTo(canvas.width - 50, tableY);
      ctx.stroke();

      tableY += 25;
      ctx.fillStyle = '#6b6b82';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('ITEM DESCRIPTION', 60, tableY);
      ctx.textAlign = 'center';
      ctx.fillText('QTY', 520, tableY);
      ctx.textAlign = 'right';
      ctx.fillText('PRICE', 740, tableY);

      tableY += 15;
      ctx.beginPath();
      ctx.moveTo(50, tableY);
      ctx.lineTo(canvas.width - 50, tableY);
      ctx.stroke();

      // Draw Items
      ctx.fillStyle = '#f1f1f7';
      ctx.font = '14px sans-serif';
      orderDetails.items.forEach(item => {
        tableY += 30;
        ctx.textAlign = 'left';
        ctx.fillText(item.name, 60, tableY);
        ctx.textAlign = 'center';
        ctx.fillText(item.qty.toString(), 520, tableY);
        ctx.textAlign = 'right';
        ctx.fillText(`₹${item.qty * item.price}`, 740, tableY);
      });

      tableY += 20;
      ctx.beginPath();
      ctx.moveTo(50, tableY);
      ctx.lineTo(canvas.width - 50, tableY);
      ctx.stroke();

      // Calculations Y
      tableY += 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#a0a0b8';
      ctx.fillText('Subtotal', 480, tableY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f1f1f7';
      ctx.fillText(`₹${orderDetails.subtotal}`, 740, tableY);

      if (orderDetails.discount > 0) {
        tableY += 25;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#a0a0b8';
        ctx.fillText(`Discount ${orderDetails.couponCode ? `(${orderDetails.couponCode})` : ''}`, 480, tableY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`-₹${orderDetails.discount}`, 740, tableY);
      }

      tableY += 25;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#a0a0b8';
      ctx.fillText('Delivery Fee', 480, tableY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f1f1f7';
      ctx.fillText(`₹${orderDetails.deliveryFee}`, 740, tableY);

      // Grand Total
      tableY += 35;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(450, tableY - 15);
      ctx.lineTo(750, tableY - 15);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f0c86a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('GRAND TOTAL', 480, tableY);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${orderDetails.total}`, 740, tableY);

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6b6b82';
      ctx.font = 'italic 14px sans-serif';
      ctx.fillText('Thank you for ordering with MoodFresher!', canvas.width / 2, 930);
      ctx.fillText('Crafted with love & 100% vegetarian ingredients.', canvas.width / 2, 950);

      resolve(canvas);
    });
  };

  // Checkout redirect and database placement
  const placeOrder = async () => {
    if (!canPlace) {
      if (!meetsMinOrder) {
        toast.error(`Minimum order amount is ₹${minOrderAmount}. Please add items worth ₹${shortfallMin} more.`)
        return
      }
      if (!isDeliverable) {
        toast.error(`Sorry for the inconvenience, we do not deliver beyond ${maxDeliveryDistance} km.`)
        return
      }
      toast.error('Please enter name, address and select at least one item before placing the order.')
      return
    }

    setPlacingOrder(true)
    
    // Build address and custom instructions info
    let combinedAddress = address
    if (instructions && instructions.trim()) {
      combinedAddress += `\nInstructions: ${instructions.trim()}`
    }
    if (location) {
      combinedAddress += `\nLive Location: ${location}`
    }

    const orderPayload = {
      customerName: name,
      customerMobile: mobile,
      customerAddress: combinedAddress,
      items: orderLines.map(it => ({
        name: it.displayName,
        price: it.price,
        qty: it.qty,
        variant: it.variant || null
      })),
      subtotal,
      discount: discountAmount,
      deliveryFee: deliveryCharge,
      total,
      couponCode: appliedCoupon ? appliedCoupon.code : ''
    }

    try {
      // 1. Save order in MongoDB
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      })
      const savedOrder = await res.json()

      if (!res.ok) {
        throw new Error(savedOrder.message || 'Failed to place order')
      }

      // 2. Generate and upload Canvas Summary Image
      const canvas = await generateInvoiceCanvas(savedOrder.orderId, orderPayload)
      
      await new Promise((resolveUpload, rejectUpload) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            rejectUpload(new Error('Failed to create canvas blob'))
            return
          }
          const formData = new FormData()
          formData.append('image', blob, `invoice_${savedOrder.orderId}.png`)
          
          try {
            const uploadRes = await fetch(`/api/orders/${savedOrder.orderId}/upload-summary`, {
              method: 'POST',
              body: formData
            })
            if (!uploadRes.ok) {
              console.warn('Invoice image upload warning, relying on default status tracker.')
            }
            resolveUpload()
          } catch (uploadErr) {
            console.error('Invoice image upload error:', uploadErr)
            resolveUpload() // Proceed anyway even if summary image fails
          }
        }, 'image/png')
      })

      // 3. Clear cart
      setQuantities({})
      setAppliedCoupon(null)
      setCouponCode('')
      try {
        await fetch(`/api/cart/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [], couponCode: '' })
        })
      } catch (cartErr) {
        console.error('Failed to clear cart in db:', cartErr)
      }

      // 4. Save placed order and open confirmation overlay
      setPlacedOrder(savedOrder)
      toast.success('Order placed successfully in our system!')
      
      // Auto open WhatsApp Link
      let waMsg = `Hello! I placed a new order on MoodFresher.\nOrder ID: ${savedOrder.orderId}\nTotal: ₹${savedOrder.total}\n\nTrack order live & view invoice details here:\n${window.location.origin}/order/${savedOrder.orderId}`;
      if (savedOrder.imageUrl) {
        waMsg += `\n\nSecure Invoice Image: ${savedOrder.imageUrl}`;
      }
      if (location) {
        waMsg += `\n\n📍 Live Location: ${location}`;
      }
      const encodedMsg = encodeURIComponent(waMsg)
      window.open(`https://wa.me/${whatsappNumber}?text=${encodedMsg}`, '_blank')

    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Network error placing order')
    } finally {
      setPlacingOrder(false)
    }
  }

  const cartCount = orderLines.reduce((s, it) => s + it.qty, 0)

  useEffect(() => { document.title = 'MoodFresher — Cafe & Restaurant' }, [])

  // Periodically refresh shop status
  useEffect(() => {
    const timer = setInterval(() => {
      if (settings) {
        // Triggers UI refresh for shop open timings
        setSettings(prev => ({ ...prev }))
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [settings])

  const closureInfo = !isOpen ? getClosureMessage(settings?.shopOpen, settings?.operatingHours) : null

  /* ── Admin Auth Actions ── */
  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setAdminError('')
    setAdminLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      })
      const data = await res.json()

      if (res.ok) {
        setAdminToken(data.token)
        localStorage.setItem('adminToken', data.token)
        setAdminEmail('')
        setAdminPassword('')
        toast.success('Successfully logged in as Admin!')
      } else {
        setAdminError(data.message || 'Invalid email or password')
      }
    } catch (err) {
      console.error(err)
      setAdminError('Server connection failed')
    } finally {
      setAdminLoading(false)
    }
  }

  const handleAdminLogout = () => {
    setAdminToken(null)
    localStorage.removeItem('adminToken')
    toast.info('Logged out from Admin Dashboard')
  }

  // Admin password update
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          oldPassword: passForm.oldPassword,
          newPassword: passForm.newPassword
        })
      })
      const data = await res.json()

      if (res.ok) {
        toast.success('Password changed successfully!')
        setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(data.message || 'Failed to change password')
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Try again.')
    }
  }

  /* ── Admin Settings Actions ── */
  const toggleShopLive = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ shopOpen: !settings.shopOpen })
      })
      const data = await res.json()
      if (res.ok) {
        setSettings(data)
        toast.success(`Shop is now ${data.shopOpen ? 'OPEN' : 'CLOSED'}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSettingsUpdate = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (res.ok) {
        setSettings(data)
        toast.success('Settings updated successfully!')
      } else {
        toast.error(data.message || 'Failed to update settings')
      }
    } catch (err) {
      console.error(err)
    }
  }

  /* ── Admin Image Upload Helper ── */
  const handleUploadImage = async (e, setField) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    toast.info('Uploading image to ImgBB...')
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        setField(data.url)
        toast.success(data.message || 'Uploaded successfully!')
      } else {
        toast.error(data.message || 'Failed uploading to ImgBB')
      }
    } catch (err) {
      console.error(err)
      toast.error('Image upload failed due to server error')
    }
  }

  /* ── Admin Item Management ── */
  const openItemModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        itemName: item.itemName,
        category: item.category,
        subcategory: item.subcategory || '',
        photoName: item.photoName || '',
        description: item.description || '',
        price: item.price !== null && item.price !== undefined ? item.price : '',
        priceHalf: item.priceHalf !== null && item.priceHalf !== undefined ? item.priceHalf : '',
        priceFull: item.priceFull !== null && item.priceFull !== undefined ? item.priceFull : '',
        hasHalfFull: item.hasHalfFull,
        isAvailable: item.isAvailable,
        weight: item.weight || '',
        breakdown: item.breakdown || '',
        originalPrice: item.originalPrice !== null && item.originalPrice !== undefined ? item.originalPrice : '',
        originalPriceHalf: item.originalPriceHalf !== null && item.originalPriceHalf !== undefined ? item.originalPriceHalf : '',
        originalPriceFull: item.originalPriceFull !== null && item.originalPriceFull !== undefined ? item.originalPriceFull : ''
      })
    } else {
      setEditingItem(null)
      setItemForm({
        itemName: '', category: 'Chinese Combos', subcategory: '', photoName: '', description: '',
        price: '', priceHalf: '', priceFull: '', hasHalfFull: false, isAvailable: true,
        weight: '', breakdown: '', originalPrice: '', originalPriceHalf: '', originalPriceFull: ''
      })
    }
    setItemModalOpen(true)
  }

  const saveItem = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!itemForm.itemName.trim()) {
      toast.error('Item name is required')
      return
    }

    const price = itemForm.price === '' ? null : Number(itemForm.price)
    const priceHalf = itemForm.priceHalf === '' ? null : Number(itemForm.priceHalf)
    const priceFull = itemForm.priceFull === '' ? null : Number(itemForm.priceFull)
    const originalPrice = itemForm.originalPrice === '' ? null : Number(itemForm.originalPrice)
    const originalPriceHalf = itemForm.originalPriceHalf === '' ? null : Number(itemForm.originalPriceHalf)
    const originalPriceFull = itemForm.originalPriceFull === '' ? null : Number(itemForm.originalPriceFull)

    const payload = {
      ...itemForm,
      price,
      priceHalf,
      priceFull,
      originalPrice,
      originalPriceHalf,
      originalPriceFull,
      hasHalfFull: !!itemForm.hasHalfFull
    }

    try {
      const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items'
      const method = editingItem ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok) {
        if (editingItem) {
          setItems(items.map(it => it.id === editingItem.id ? data : it))
          toast.success('Item updated successfully!')
        } else {
          setItems([...items, data])
          toast.success('New item added!')
        }
        setItemModalOpen(false)
      } else {
        toast.error(data.message || 'Failed to save item')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this food item?')) return

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      if (res.ok) {
        setItems(items.filter(it => it.id !== id))
        toast.success('Item deleted successfully')
      } else {
        const data = await res.json()
        toast.error(data.message || 'Could not delete item')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleItemAvailability = async (item) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      })
      const data = await res.json()
      if (res.ok) {
        setItems(items.map(it => it.id === item.id ? data : it))
        toast.success(`"${item.itemName}" is now ${data.isAvailable ? 'Available' : 'Unavailable'}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  /* ── Admin Coupon Management ── */
  const openCouponModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon)
      setCouponForm({
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        minAmount: coupon.minAmount,
        description: coupon.description,
        isActive: coupon.isActive
      })
    } else {
      setEditingCoupon(null)
      setCouponForm({
        code: '', discountPercent: '', minAmount: '', description: '', isActive: true
      })
    }
    setCouponModalOpen(true)
  }

  const saveCoupon = async (e) => {
    e.preventDefault()
    if (!couponForm.code.trim()) {
      toast.error('Coupon code is required')
      return
    }

    try {
      const url = editingCoupon ? `/api/coupons/${editingCoupon._id}` : '/api/coupons'
      const method = editingCoupon ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(couponForm)
      })
      const data = await res.json()

      if (res.ok) {
        if (editingCoupon) {
          setAdminCoupons(adminCoupons.map(c => c._id === editingCoupon._id ? data : c))
          toast.success('Coupon updated!')
        } else {
          setAdminCoupons([data, ...adminCoupons])
          toast.success('Coupon created!')
        }
        setCouponModalOpen(false)
      } else {
        toast.error(data.message || 'Failed to save coupon')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const deleteCoupon = async (id) => {
    if (!window.confirm('Delete this coupon?')) return
    try {
      const res = await fetch(`/api/coupons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      if (res.ok) {
        setAdminCoupons(adminCoupons.filter(c => c._id !== id))
        toast.success('Coupon deleted')
      }
    } catch (err) {
      console.error(err)
    }
  }

  /* ── Admin Orders Management ── */
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Order status updated to "${newStatus}"!`)
        // Update local list
        setAdminOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: newStatus } : o))
        // Update selected order details
        if (selectedAdminOrder && selectedAdminOrder.orderId === orderId) {
          setSelectedAdminOrder({ ...selectedAdminOrder, status: newStatus })
        }
      } else {
        toast.error(data.message || 'Failed to update order status')
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error updating status')
    }
  }

  /* ── Admin Banners Management ── */
  const openBannerModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner)
      setBannerForm({
        title: banner.title,
        description: banner.description,
        image: banner.image,
        couponCode: banner.couponCode || '',
        isActive: banner.isActive
      })
    } else {
      setEditingBanner(null)
      setBannerForm({
        title: '', description: '', image: '', couponCode: '', isActive: true
      })
    }
    setBannerModalOpen(true)
  }

  const saveBanner = async (e) => {
    e.preventDefault()
    if (!bannerForm.title.trim()) {
      toast.error('Banner title is required')
      return
    }

    try {
      const url = editingBanner ? `/api/banners/${editingBanner._id}` : '/api/banners'
      const method = editingBanner ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(bannerForm)
      })
      const data = await res.json()

      if (res.ok) {
        if (editingBanner) {
          setAdminBanners(adminBanners.map(b => b._id === editingBanner._id ? data : b))
          toast.success('Offer component updated!')
        } else {
          setAdminBanners([data, ...adminBanners])
          toast.success('Offer component created!')
        }
        setBannerModalOpen(false)
        // Refresh homepage banners list
        fetch('/api/banners').then(r => r.json()).then(setBanners)
      } else {
        toast.error(data.message || 'Failed to save banner')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const deleteBanner = async (id) => {
    if (!window.confirm('Delete this promotional banner?')) return
    try {
      const res = await fetch(`/api/banners/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      if (res.ok) {
        setAdminBanners(adminBanners.filter(b => b._id !== id))
        toast.success('Banner removed')
        fetch('/api/banners').then(r => r.json()).then(setBanners)
      }
    } catch (err) {
      console.error(err)
    }
  }

  /* ── Order Panel Content ── */
  const renderOrderContent = () => (
    <>
      {/* Celebration overlay */}
      {showCelebration && celebratedTier && (() => {
        const nextTierAfter = getNextTier(celebratedTier.minAmount)
        const amtSaved = Math.round((subtotal * celebratedTier.discountPercent) / 100)
        return (
          <div className="celebration-overlay">
            <div className="celebration-content">
              <div className="celebration-sparkles">✨🎉✨</div>
              <div className="celebration-title">{celebratedTier.emoji} {celebratedTier.label} Unlocked!</div>
              <div className="celebration-sub">You saved ₹{amtSaved} on this order! 🎊</div>
              <div className="celebration-bar">
                <div className="celebration-fill" style={{ width: '100%' }}></div>
              </div>
              {nextTierAfter && (
                <div className="celebration-upsell">
                  <div className="upsell-divider"></div>
                  <div className="upsell-text">
                    ⬆️ Add <strong>₹{Math.max(0, nextTierAfter.minAmount - subtotal)}</strong> more to get <strong>{nextTierAfter.emoji} {nextTierAfter.label}</strong>
                  </div>
                </div>
              )}
              {!nextTierAfter && (
                <div className="celebration-upsell">
                  <div className="upsell-divider"></div>
                  <div className="upsell-text max">
                    🏆 Maximum discount achieved! You're saving big today.
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <h4>Order summary</h4>

      {/* Discount Ladder / Progress Bar (Only visible when no custom coupon is applied) */}
      {subtotal > 0 && !appliedCoupon && (
        <div className="discount-ladder">
          <div className="ladder-header">
            <span className="ladder-title">🎯 Discount Ladder</span>
            {activeTier ? (
              <span className="ladder-badge unlocked">{activeTier.emoji} {activeTier.label}</span>
            ) : (
              <span className="ladder-badge locked">No discount</span>
            )}
          </div>
          <div className="ladder-track">
            <div className="ladder-progress" style={{ width: `${discountProgress}%` }}></div>
            {DISCOUNT_TIERS.map(tier => {
              const pos = ((tier.minAmount - minOrderAmount) / (DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minAmount - minOrderAmount)) * 100
              const isUnlocked = subtotal >= tier.minAmount
              return (
                <div
                  key={tier.minAmount}
                  className={`ladder-marker ${isUnlocked ? 'unlocked' : 'locked'}`}
                  style={{ left: `${Math.min(95, Math.max(5, pos))}%` }}
                >
                  <div className="marker-dot">{isUnlocked ? '✓' : '🎯'}</div>
                  <div className="marker-label">{tier.emoji} {tier.label}</div>
                  <div className="marker-amount">₹{tier.minAmount}</div>
                </div>
              )
            })}
          </div>
          <div className="ladder-footer">
            {subtotal < minOrderAmount && (
              <div className="ladder-msg min-order-msg">
                🚫 Add ₹{shortfallMin} more — min order ₹{minOrderAmount}
              </div>
            )}
            {subtotal >= minOrderAmount && !activeTier && nextTier && (
              <div className="ladder-msg unlock-msg">
                🎯 Add ₹{shortfallNext} more to get {nextTier.emoji} {nextTier.label}
              </div>
            )}
            {activeTier && nextTier && (
              <div className="ladder-msg next-msg">
                ⬆️ Add ₹{shortfallNext} more to get {nextTier.emoji} {nextTier.label}
              </div>
            )}
            {activeTier && !nextTier && (
              <div className="ladder-msg max-msg">
                🏆 Max discount unlocked! You're saving {discountPercent}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order lines */}
      {orderLines.length === 0 ? <div className="empty">No items selected</div> : (
        <div>
          <ul className="order-lines">
            {orderLines.map((it, idx) => (
              <li key={idx}>
                <span>
                  {it.displayName}
                  <span className="line-qty"> x {it.qty}</span>
                </span>
                <strong>₹{it.lineTotal}</strong>
              </li>
            ))}
          </ul>

          {/* Coupon Code Input */}
          <div className="coupon-block">
            <div className="coupon-header">
              <span className="coupon-title">🏷️ Promo Code</span>
              {appliedCoupon && (
                <button onClick={removeCoupon} className="coupon-remove-btn">Remove</button>
              )}
            </div>
            <form onSubmit={applyCoupon} className="coupon-form">
              <input
                type="text"
                className="coupon-input"
                placeholder="Enter Coupon Code"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                disabled={!isOpen || !!appliedCoupon}
              />
              {!appliedCoupon && (
                <button type="submit" disabled={!isOpen || !couponCode.trim()} className="admin-btn admin-btn-primary" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 'var(--radius-sm)' }}>Apply</button>
              )}
            </form>
            {couponError && <div className="coupon-error-msg">❌ {couponError}</div>}
            {appliedCoupon && (
              <div className="coupon-success-msg">
                ✓ Coupon <strong>{appliedCoupon.code}</strong> applied! (<strong>{appliedCoupon.discountPercent}% OFF</strong>)
              </div>
            )}
          </div>

          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          {deliveryDistance != null && (
            <div className={`summary-row delivery ${!isDeliverable ? 'not-deliverable' : ''}`}>
              <span>
                Delivery
                <span className="delivery-distance">{deliveryDistance.toFixed(1)} km</span>
              </span>
              <span className={!isDeliverable ? 'not-deliverable-text' : (deliveryCharge > 0 ? '' : 'free-delivery')}>
                {!isDeliverable ? 'Not Serviceable' : (deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE')}
              </span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="summary-row discount-row">
              <span>
                Discount
                <span className="discount-badge">{appliedCoupon ? 'COUPON' : `${discountPercent}% OFF`}</span>
              </span>
              <span className="discount-amount">-₹{discountAmount}</span>
            </div>
          )}
          <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
          {deliveryDistance != null && deliveryCharge > 0 && isDeliverable && (
            <div className="delivery-note">
              🚗 {FREE_DELIVERY_KM} km free, then ₹{DELIVERY_CHARGE_PER_KM}/km extra.
              Beyond {FREE_DELIVERY_KM} km: {Math.round(deliveryDistance - FREE_DELIVERY_KM)} km
            </div>
          )}
          {deliveryDistance != null && deliveryCharge === 0 && isDeliverable && (
            <div className="delivery-note free">
              🚗 Free delivery within {FREE_DELIVERY_KM} km of our restaurant!
            </div>
          )}
        </div>
      )}

      {/* Customer inputs */}
      <div className="cust-inputs">
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} disabled={!isOpen} />
        <input placeholder="Mobile number" value={mobile} onChange={e => setMobile(e.target.value)} style={{marginTop:8}} disabled={!isOpen} />
        <textarea placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} rows={3} disabled={!isOpen} />
        <textarea placeholder="Delivery instructions (optional)" value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} disabled={!isOpen} />
        <button
          className={`loc-btn ${location ? 'shared' : ''}`}
          onClick={getUserLocation}
          disabled={!isOpen || locating}
        >
          {locating ? '📍 Getting location...' : location ? '📍 Location shared ✓' : '📍 Share live location'}
        </button>
      </div>

      {/* Place order button */}
      {deliveryDistance != null && !isDeliverable && (
        <div className="delivery-note error" style={{color: 'red', fontWeight: 'bold', marginBottom: 12, textAlign: 'center'}}>
          🚫 Sorry for the inconvenience, we do not deliver beyond {maxDeliveryDistance} km.
        </div>
      )}
      <button
        className="place-btn enabled"
        onClick={() => {
          if (orderLines.length === 0) {
            toast.error('Your cart is empty. Please add items to order.')
            return
          }
          if (!meetsMinOrder) {
            toast.error(`Minimum order amount is ₹${minOrderAmount}. Please add items worth ₹${shortfallMin} more.`)
            return
          }
          if (deliveryDistance != null && !isDeliverable) {
            toast.error(`Sorry for the inconvenience, we do not deliver beyond ${maxDeliveryDistance} km.`)
            return
          }
          
          const hasDetails = name.trim() && mobile.trim() && address.trim()
          if (!hasDetails) {
            setDetailsModalOpen(true)
          } else {
            placeOrder()
          }
        }}
        disabled={false}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Place order
        </div>
      </button>
    </>
  )

  const renderMenuGrid = (itemsList) => (
    <div className="menu-grid">
      {itemsList.map(item => {
        // Pre-calculate discount percentage for single price items
        const dropPercent = item.originalPrice && item.originalPrice > item.price
          ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
          : null;

        // Pre-calculate discount percentages for variant items
        const dropPercentHalf = item.originalPriceHalf && item.originalPriceHalf > item.priceHalf
          ? Math.round(((item.originalPriceHalf - item.priceHalf) / item.originalPriceHalf) * 100)
          : null;
        
        const dropPercentFull = item.originalPriceFull && item.originalPriceFull > item.priceFull
          ? Math.round(((item.originalPriceFull - item.priceFull) / item.originalPriceFull) * 100)
          : null;

        return (
          <article className="menu-card" key={item.id}>
            <div className="menu-card-img-wrapper">
              <div className="food-img" style={{ backgroundImage: item.img ? `url(${item.img})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              <span className="veg-indicator">●</span>
            </div>
            <div className="menu-info">
              <div>
                <div className="menu-title">{item.name}</div>
                {item.weight && (
                  <div className="portion-badge">
                    <span>⚖️</span> {item.weight}
                  </div>
                )}
                <div className="menu-desc">{item.desc}</div>
                {item.breakdown && (
                  <div className="portion-breakdown">
                    <strong>Contains:</strong> {item.breakdown}
                  </div>
                )}
              </div>
              {item.hasHalfFull ? (
                <div className="menu-footer half-full-footer">
                  <div className="variant-row">
                    <div className="variant-info">
                      <span className="variant-label half-label">Half</span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {dropPercentHalf && (
                          <span className="price-original" style={{ fontSize: '0.8em', marginRight: 4 }}>₹{item.originalPriceHalf}</span>
                        )}
                        <span className="variant-price">₹{item.priceHalf}</span>
                        {dropPercentHalf && (
                          <span className="price-discount-tag" style={{ marginLeft: 4, padding: '1px 4px', fontSize: 9 }}>{dropPercentHalf}% OFF</span>
                        )}
                      </div>
                    </div>
                    {quantities[`${item.id}_half`] > 0 ? (
                      <div className="qty-stepper">
                        <button disabled={!isOpen} onClick={() => dec(`${item.id}_half`)}>−</button>
                        <span className="qty-value">{quantities[`${item.id}_half`]}</span>
                        <button disabled={!isOpen} onClick={() => inc(`${item.id}_half`)}>+</button>
                      </div>
                    ) : (
                      <button className="add-btn" disabled={!isOpen} onClick={() => { inc(`${item.id}_half`); }}>ADD</button>
                    )}
                  </div>
                  <div className="variant-row">
                    <div className="variant-info">
                      <span className="variant-label full-label">Full</span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {dropPercentFull && (
                          <span className="price-original" style={{ fontSize: '0.8em', marginRight: 4 }}>₹{item.originalPriceFull}</span>
                        )}
                        <span className="variant-price">₹{item.priceFull}</span>
                        {dropPercentFull && (
                          <span className="price-discount-tag" style={{ marginLeft: 4, padding: '1px 4px', fontSize: 9 }}>{dropPercentFull}% OFF</span>
                        )}
                      </div>
                    </div>
                    {quantities[`${item.id}_full`] > 0 ? (
                      <div className="qty-stepper">
                        <button disabled={!isOpen} onClick={() => dec(`${item.id}_full`)}>−</button>
                        <span className="qty-value">{quantities[`${item.id}_full`]}</span>
                        <button disabled={!isOpen} onClick={() => inc(`${item.id}_full`)}>+</button>
                      </div>
                    ) : (
                      <button className="add-btn" disabled={!isOpen} onClick={() => { inc(`${item.id}_full`); }}>ADD</button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="menu-footer">
                  <div className="price">
                    {dropPercent && (
                      <span className="price-original">₹{item.originalPrice}</span>
                    )}
                    ₹{item.price}
                    {dropPercent && (
                      <span className="price-discount-tag">{dropPercent}% OFF</span>
                    )}
                  </div>
                  {quantities[item.id] > 0 ? (
                    <div className="qty-stepper">
                      <button disabled={!isOpen} onClick={() => dec(`${item.id}`)}>−</button>
                      <span className="qty-value">{quantities[item.id]}</span>
                      <button disabled={!isOpen} onClick={() => inc(`${item.id}`)}>+</button>
                    </div>
                  ) : (
                    <button className="add-btn" disabled={!isOpen} onClick={() => { inc(`${item.id}`); }}>ADD</button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  )

  // RENDER CUSTOMER HOME (if view !== 'admin')
  const renderCustomerView = () => {
    if (loading) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)'
        }}>
          <div className="loader-spinner" style={{
            border: '4px solid rgba(212, 162, 76, 0.1)',
            borderTop: '4px solid var(--gold)',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gold-light)', margin: 0 }}>MoodFresher</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>Loading delicious dishes...</p>
        </div>
      )
    }

    return (
      <div className="app-root">
        <header className="topbar">
          <div className="brand" onClick={() => navigate('menu')} style={{ cursor: 'pointer' }}>
            <img className="brand-logo" src={brandLogo} alt="MoodFresher" />
            <div className="brand-text">
              <div className="logo">MoodFresher</div>
              <div className="tag">Cafe & Restaurant</div>
            </div>
            <span className="veg-badge">🟢 VEG</span>
          </div>
          <nav className={`top-nav ${navOpen ? 'open' : ''}`}>
            <button className={view === 'menu' ? 'active' : ''} onClick={() => { navigate('menu'); setNavOpen(false); }}>Menu</button>
            <button className={view === 'contact' ? 'active' : ''} onClick={() => { navigate('contact'); setNavOpen(false); }}>Contact</button>
            <button className={view === 'about' ? 'active' : ''} onClick={() => { navigate('about'); setNavOpen(false); }}>About</button>
          </nav>
          <button className="hamburger" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </header>

        {view === 'menu' && (
          <>
            <section className="hero-banner">
              <div className="hero-content">
                <span className="hero-veg-badge">🟢 100% PURE VEGETARIAN</span>
                <h2>Heavenly Veg Delights, Crafted for True Foodies!</h2>
                <p className="hero-subtitle">From sizzling tikkas & rich authentic curries to crispy golden waffles, enjoy premium taste cooked fresh daily.</p>
                <div className="hero-trust-row">
                  <span className="hero-trust-item">🏷️ Direct Savings</span>
                  <span className="hero-trust-item">🌱 100% Pure Veg</span>
                  <span className="hero-trust-item">🍳 Fresh & Hygenic</span>
                  <span className="hero-trust-item">🔥 Piping Hot Delivery</span>
                </div>
                <div className="hero-actions">
                  <button className="hero-btn-primary" onClick={() => { const el = document.querySelector('.category-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>Taste the Magic</button>
                </div>
              </div>
            </section>

            {/* Special Offers Banner / UI Component */}
            {banners.length > 0 && (
              <section className="offers-carousel-section">
                <div className="section-header">
                  <h4>🔥 Today's Exclusive Foodie Deals</h4>
                </div>
                <div className="offers-grid">
                  {banners.map(banner => (
                    <div key={banner._id} className="offer-banner-card" onClick={() => {
                      if (banner.couponCode) {
                        autoApplyCoupon(banner.couponCode)
                        scrollToOrderPanel()
                      }
                    }}>
                      {banner.image && <img src={banner.image} alt={banner.title} className="offer-banner-img" />}
                      <div className="offer-banner-details">
                        <h5>{banner.title}</h5>
                        <p>{banner.description}</p>
                        {banner.couponCode && (
                          <span className="offer-coupon-badge">Use Code: <strong>{banner.couponCode}</strong> (Click to apply)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="promo-strip">
              <div className="promo-card promo-green">
                <span className="promo-icon">🚚</span>
                <div className="promo-text">
                  <div className="promo-title">PIPING HOT DELIVERY</div>
                  <div className="promo-sub">Free within 3 km • ₹10/km beyond</div>
                </div>
              </div>
              <div className="promo-card promo-gold">
                <span className="promo-icon">💰</span>
                <div className="promo-text">
                  <div className="promo-title">PURE FOODIE SAVINGS</div>
                  <div className="promo-sub">Zero markups, direct from our kitchen</div>
                </div>
              </div>
              <div className="promo-card promo-orange">
                <span className="promo-icon">🎉</span>
                <div className="promo-text">
                  <div className="promo-title">FESTIVE VEG FEASTS</div>
                  <div className="promo-sub">Catering & bulk orders from 50+ plates</div>
                </div>
              </div>
            </section>
          </>
        )}

        {!isOpen && !exploreMenu && (
          <div className="shop-closed-overlay">
            <div className="shop-closed-card">
              <span className="closed-icon">{closureInfo?.icon || '🔒'}</span>
              <h2>{closureInfo?.title || 'Currently Unavailable'}</h2>
              <p>{closureInfo?.detail || ''}</p>
              <p style={{marginTop:-12, marginBottom:24, fontSize:14, color:'var(--text-muted)'}}>
                You can still explore our menu below, but ordering will not be available.
              </p>
              <div className="closed-actions">
                <button className="primary" onClick={() => setExploreMenu(true)}>Explore Menu</button>
                <button className="wa-btn" onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}>Message on WhatsApp</button>
                <button className="secondary" onClick={() => { navigate('contact'); }}>Contact Us</button>
              </div>
            </div>
          </div>
        )}

        <div className={`content-wrapper ${!isOpen && !exploreMenu ? 'blurred' : ''}`}>
          {view === 'menu' && (
            <section className="category-section">
              <div className="category-section-title">
                <span className="title-line"></span>
                <h3>Explore Our Menu</h3>
                <span className="title-line"></span>
              </div>
              <div className="category-row" ref={catRowRef}>
                {CATEGORIES.map(cat => (
                  <button key={cat} className={`cat-item ${cat === activeCat ? 'active' : ''}`} onClick={() => setActiveCat(cat)}>
                    <div className="cat-img-wrapper">
                      <img className="cat-img" src={getCategoryImage(cat)} alt={cat} />
                    </div>
                    <span className="cat-label">{cat}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view === 'menu' ? (
            <main className="content">
              <section className="menu-section">
                {activeCat === 'Waffle Hut' ? (
                  <div className="waffle-hut-container">
                    {[...new Set(visibleMenu.map(item => item.subcategory))].map(subcat => {
                      if (!subcat) return null
                      const isExpanded = expandedSubcats[subcat]
                      const itemsList = visibleMenu.filter(item => item.subcategory === subcat)
                      return (
                        <div className="subcategory-section" key={subcat}>
                          <button className="subcategory-header" onClick={() => setExpandedSubcats(prev => ({...prev, [subcat]: !prev[subcat]}))}>
                            <h3>{subcat}</h3>
                            <span className={`chevron ${isExpanded ? 'open' : ''}`}>▼</span>
                          </button>
                          {isExpanded && renderMenuGrid(itemsList)}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  renderMenuGrid(visibleMenu)
                )}
              </section>

              <aside className="order-panel" ref={orderPanelRef}>
                {renderOrderContent()}
              </aside>
            </main>
          ) : view === 'contact' ? (
            <main className="content contact-page">
              <section>
                <h3>Contact Us</h3>
                <p>Have a question or want to place a large/bulk order? Reach out using the details below or message us on WhatsApp.</p>
                <div className="contact-grid">
                  <div className="contact-card">
                    <span className="contact-icon">📞</span>
                    <div className="contact-text">
                      <div className="contact-label">Phone</div>
                      <a className="contact-value" href={`tel:+${whatsappNumber}`}>+91 {whatsappNumber.slice(2)}</a>
                    </div>
                  </div>
                  <div className="contact-card">
                    <span className="contact-icon">📍</span>
                    <div className="contact-text">
                      <div className="contact-label">Address</div>
                      <div className="contact-value">27/17 Elgin Road, Civil Lines, Prayagraj</div>
                    </div>
                  </div>
                  <div className="contact-card">
                    <span className="contact-icon">✉️</span>
                    <div className="contact-text">
                      <div className="contact-label">Email</div>
                      <div className="contact-value">moodfresher.24@gmail.com</div>
                    </div>
                  </div>
                </div>
                <h4>Opening Hours</h4>
                <table className="opening-table">
                  <tbody>
                    <tr>
                      <td>
                        {(() => {
                          if (!settings) return 'All 7 days'
                          const days = settings.operatingHours.days
                          if (days.length === 7) return 'All 7 days'
                          const short = days.map(d => d.slice(0, 3))
                          if (short.length <= 3) return short.join(', ')
                          return `${short[0]}–${short[short.length-1]}`
                        })()}
                      </td>
                      <td>{settings ? `${formatTime(settings.operatingHours.openTime)} — ${formatTime(settings.operatingHours.closeTime)}` : ''}</td>
                    </tr>
                    {(() => {
                      if (!settings) return null
                      const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                      const closedDays = allDays.filter(d => !settings.operatingHours.days.includes(d))
                      if (closedDays.length > 0) {
                        return closedDays.map(d => (
                          <tr key={d} style={{ opacity: 0.6 }}>
                            <td>{d}</td>
                            <td>Closed</td>
                          </tr>
                        ))
                      }
                      return null
                    })()}
                  </tbody>
                </table>
                <div>
                  <h4>Bulk & Catering</h4>
                  <p>We accept orders for parties & marriages. Bulk orders starting from 50+ plates — message us for a quote.</p>
                </div>
              </section>
              <aside className="order-panel">
                <h4>Quick Contact</h4>
                <p style={{color:'var(--text-secondary)',marginTop:6,fontSize:14}}>Send a WhatsApp message with your query</p>
                <button className="place-btn enabled" onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hello, I would like to enquire about...')}`, '_blank')}>Message on WhatsApp</button>
                <button className="primary" style={{marginTop:12}} onClick={() => navigate('menu')}>Explore our menu</button>
              </aside>
            </main>
          ) : (
            <main className="content about-page">
              <section className="about-section">
                <h3>About MoodFresher</h3>
                <p className="about-lead">Your favorite neighborhood cafe & restaurant in Prayagraj, serving delicious 100% vegetarian food with love since day one.</p>
                <div className="about-grid">
                  <div className="about-card"><span className="about-card-icon">🍽️</span><h4>100% Vegetarian</h4><p>Pure vegetarian kitchen serving authentic Indian, Chinese, and fusion cuisine.</p></div>
                  <div className="about-card"><span className="about-card-icon">🏠</span><h4>Home-Style Taste</h4><p>Made fresh to order with quality ingredients, just like home cooking.</p></div>
                  <div className="about-card"><span className="about-card-icon">🚀</span><h4>Fast Delivery</h4><p>Quick delivery within 30-45 minutes to your doorstep.</p></div>
                  <div className="about-card"><span className="about-card-icon">💰</span><h4>Best Value</h4><p>Order direct and save more — no middlemen, just great prices.</p></div>
                </div>
                <div style={{marginTop: 32}}>
                  <button className="hero-btn-primary" onClick={() => navigate('menu')}>Explore Our Menu</button>
                </div>
              </section>
            </main>
          )}

          {/* Footer */}
          <footer className="site-footer">
            <div className="footer-content">
              <div className="footer-grid">
                <div className="footer-col">
                  <div className="footer-brand">
                    <img src={brandLogo} alt="MoodFresher" className="footer-logo" />
                    <div>
                      <div className="footer-brand-name">MoodFresher</div>
                      <div className="footer-brand-tag">Cafe & Restaurant</div>
                    </div>
                  </div>
                  <p className="footer-desc">Delicious food delivered fresh to your doorstep. Made with love in Prayagraj.</p>
                </div>
                <div className="footer-col">
                  <h4 className="footer-col-title">Quick Links</h4>
                  <ul className="footer-links">
                    <li><button onClick={() => navigate('menu')}>🍽️ Menu</button></li>
                    <li><button onClick={() => navigate('contact')}>📞 Contact</button></li>
                    <li><button onClick={() => navigate('about')}>ℹ️ About</button></li>
                  </ul>
                </div>
                <div className="footer-col">
                  <h4 className="footer-col-title">Visit Us</h4>
                  <p className="footer-address">📍 27/17 Elgin Road, Civil Lines, Prayagraj</p>
                  <p className="footer-hours">🕐 {settings ? `${formatTime(settings.operatingHours.openTime)} — ${formatTime(settings.operatingHours.closeTime)}` : ''}</p>
                </div>
                <div className="footer-col">
                  <h4 className="footer-col-title">Get in Touch</h4>
                  <p className="footer-contact-item">📞 +91 {whatsappNumber.slice(2)}</p>
                  <p className="footer-contact-item">✉️ moodfresher.24@gmail.com</p>
                  <button className="footer-wa-btn" onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}>💬 Chat on WhatsApp</button>
                </div>
              </div>
              <div className="trust-strip">
                <div className="trust-strip-item"><span className="trust-strip-icon">🛒</span><div className="trust-strip-text"><div className="trust-strip-label">MIN ORDER</div><div>₹{minOrderAmount}</div></div></div>
                <div className="trust-strip-item"><span className="trust-strip-icon">🕐</span><div className="trust-strip-text"><div className="trust-strip-label">DELIVERY TIME</div><div>30–45 min</div></div></div>
                <div className="trust-strip-item"><span className="trust-strip-icon">✅</span><div className="trust-strip-text"><div className="trust-strip-label">SAFE & HYGIENIC</div><div>Packaging</div></div></div>
                <div className="trust-strip-item"><span className="trust-strip-icon">💬</span><div className="trust-strip-text"><div className="trust-strip-label">LIVE SUPPORT</div><div>On WhatsApp</div></div></div>
              </div>
              <div className="footer-bottom">
                <p>Thank you for choosing Mood Fresher! ❤️</p>
                <p className="footer-copy">© {new Date().getFullYear()} MoodFresher. All rights reserved.</p>
              </div>
            </div>
          </footer>

          {/* Bottom Bar Container */}
          {view === 'menu' && cartCount > 0 && (
            <div className="bottom-bar-container">
              <div className="bottom-bar-promo">
                {subtotal < minOrderAmount && (
                  <span>Add ₹{shortfallMin} more for min order</span>
                )}
                {subtotal >= minOrderAmount && nextTier && !appliedCoupon && (
                  <span>Add ₹{shortfallNext} more for {nextTier.label}</span>
                )}
                {activeTier && !nextTier && !appliedCoupon && (
                  <span>🏆 Max discount of {activeTier.label} unlocked!</span>
                )}
                {appliedCoupon && (
                  <span>🏷️ Coupon <strong>{appliedCoupon.code}</strong> applied!</span>
                )}
              </div>
              <div className="bottom-bar">
                <div className="bottom-bar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span key={`count-${cartCount}`} className="bottom-bar-count" style={{ display: 'inline-block', animation: 'countBounce 0.3s ease' }}>
                    {cartCount} item{cartCount > 1 ? 's' : ''}
                  </span>
                  <span key={`total-${total}`} className="bottom-bar-total" style={{ display: 'inline-block', animation: 'countBounce 0.3s ease' }}>
                    ₹{total}
                  </span>
                  {discountAmount > 0 && (
                    <span key={`saved-${discountAmount}`} className="bottom-bar-discount" style={{ display: 'inline-block', animation: 'countBounce 0.3s ease' }}>
                      saved ₹{discountAmount}
                    </span>
                  )}
                </div>
                <button className="bottom-bar-btn" onClick={() => {
                  const hasDetails = name.trim() && mobile.trim() && address.trim()
                  if (!hasDetails) {
                    setDetailsModalOpen(true)
                  } else {
                    scrollToOrderPanel()
                  }
                }}>
                  View Cart →
                </button>
              </div>
            </div>
          )}
          
          {/* Placing Order Loading Overlay */}
          {placingOrder && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 5, 10, 0.82)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              color: 'var(--text-primary)'
            }}>
              <div className="loader-spinner" style={{
                border: '4px solid rgba(212, 162, 76, 0.1)',
                borderTop: '4px solid var(--gold)',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
              }}></div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gold-light)', margin: 0 }}>MoodFresher</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>Securing your order & generating invoice...</p>
            </div>
          )}

          {/* Placed Order Success Modal */}
          {placedOrder && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 5, 10, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}>
              <div className="shop-closed-card" style={{ maxWidth: '440px', padding: '40px 32px', animation: 'modalScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="closed-icon" style={{
                  background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1) 0%, rgba(37, 211, 102, 0.02) 100%)',
                  border: '1px solid rgba(37, 211, 102, 0.2)',
                  color: '#25D366'
                }}>🎉</span>
                <h2 style={{ color: 'var(--gold-light)', fontSize: '22px', marginBottom: '12px' }}>Order Successfully Placed!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                  Your order has been saved. To confirm and place the order with our kitchen, please click <strong>"Confirm on WhatsApp"</strong> below.
                </p>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  width: '100%',
                  marginBottom: '24px',
                  textAlign: 'left',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold-light)' }}>{placedOrder.orderId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>
                    <span style={{ fontWeight: 'bold' }}>₹{placedOrder.total}</span>
                  </div>
                </div>

                <div className="closed-actions" style={{ width: '100%', flexDirection: 'column', gap: '10px' }}>
                  <button className="wa-btn" style={{ width: '100%', padding: '12px 16px' }} onClick={() => {
                    let waMsg = `Hello! I placed a new order on MoodFresher.\nOrder ID: ${placedOrder.orderId}\nTotal: ₹${placedOrder.total}\n\nTrack order live & view invoice details here:\n${window.location.origin}/order/${placedOrder.orderId}`;
                    if (placedOrder.imageUrl) {
                      waMsg += `\n\nSecure Invoice Image: ${placedOrder.imageUrl}`;
                    }
                    if (location) {
                      waMsg += `\n\n📍 Live Location: ${location}`;
                    }
                    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMsg)}`, '_blank');
                  }}>
                    💬 Confirm on WhatsApp
                  </button>
                  
                  <button className="primary" style={{ width: '100%', padding: '12px 16px' }} onClick={() => {
                    window.open(`/order/${placedOrder.orderId}`, '_blank');
                  }}>
                    📋 Track Live Status
                  </button>
                  
                  <button className="secondary" style={{ width: '100%', padding: '12px 16px' }} onClick={() => setPlacedOrder(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Customer Details Entry Modal */}
          {detailsModalOpen && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 5, 10, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}>
              <div className="shop-closed-card" style={{ maxWidth: '440px', padding: '36px 28px', animation: 'modalScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--gold-light)', margin: 0 }}>Delivery Information</h3>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '24px', cursor: 'pointer', padding: 0, lineHeight: 1 }} onClick={() => setDetailsModalOpen(false)}>&times;</button>
                </div>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  setDetailsModalOpen(false);
                  placeOrder();
                }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Your Name</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', fontSize: '14px', width: '100%' }}
                      placeholder="Enter your full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Mobile Number</label>
                    <input
                      type="tel"
                      className="form-control"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', fontSize: '14px', width: '100%' }}
                      placeholder="Enter mobile number"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Delivery Address</label>
                    <textarea
                      className="form-control"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', fontSize: '14px', width: '100%', resize: 'none' }}
                      placeholder="Flat/House No., Building Name, Street Address, Area"
                      rows={3}
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Delivery Instructions (Optional)</label>
                    <textarea
                      className="form-control"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', fontSize: '14px', width: '100%', resize: 'none' }}
                      placeholder="e.g. Ring the bell, keep near gate, etc."
                      rows={2}
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                    />
                  </div>

                  <div style={{ margin: '4px 0' }}>
                    <button
                      type="button"
                      className={`loc-btn ${location ? 'shared' : ''}`}
                      onClick={getUserLocation}
                      disabled={locating}
                      style={{ width: '100%' }}
                    >
                      {locating ? '📍 Getting location...' : location ? '📍 Location shared ✓' : '📍 Share live location'}
                    </button>
                  </div>

                  <button type="submit" className="admin-btn admin-btn-primary" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--bg-primary)', border: 'none', padding: '14px', borderRadius: '30px', fontWeight: '700', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', width: '100%', marginTop: '8px', justifyContent: 'center' }}>
                    Confirm & Place Order
                  </button>

                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // RENDER ADMIN DASHBOARD (if view === 'admin')
  const renderAdminView = () => {
    if (!adminToken) {
      // Admin Login Panel
      return (
        <div className="admin-login-container">
          <div className="admin-login-card">
            <img src={brandLogo} alt="MoodFresher Logo" className="login-logo" />
            <h3>MoodFresher Admin</h3>
            <p>Sign in to manage food items, coupons, offers, and settings</p>
            {adminError && <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>⚠️ {adminError}</div>}
            <form onSubmit={handleAdminLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="admin@moodfresher.com"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={adminLoading} className="admin-btn admin-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                {adminLoading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" onClick={() => navigate('menu')} className="admin-btn admin-btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '12px' }}>
                Back to Customer Website
              </button>
            </form>
          </div>
        </div>
      )
    }

    // Filtered admin items
    const filteredAdminItems = items.filter(it =>
      it.itemName.toLowerCase().includes(itemSearch.toLowerCase()) ||
      it.category.toLowerCase().includes(itemSearch.toLowerCase())
    )

    // Main Dashboard Layout
    return (
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <img src={brandLogo} alt="Logo" />
            <div className="admin-brand-name">MoodFresher</div>
          </div>
          <nav className="admin-nav">
            <button className={`admin-nav-btn ${adminView === 'dashboard' ? 'active' : ''}`} onClick={() => setAdminView('dashboard')}>📊 Dashboard</button>
            <button className={`admin-nav-btn ${adminView === 'orders' ? 'active' : ''}`} onClick={() => setAdminView('orders')}>📦 Orders</button>
            <button className={`admin-nav-btn ${adminView === 'menu' ? 'active' : ''}`} onClick={() => setAdminView('menu')}>🍽️ Manage Menu</button>
            <button className={`admin-nav-btn ${adminView === 'coupons' ? 'active' : ''}`} onClick={() => setAdminView('coupons')}>🏷️ Coupons</button>
            <button className={`admin-nav-btn ${adminView === 'banners' ? 'active' : ''}`} onClick={() => setAdminView('banners')}>🖼️ Offers & Banners</button>
            <button className={`admin-nav-btn ${adminView === 'settings' ? 'active' : ''}`} onClick={() => setAdminView('settings')}>⚙️ Settings</button>
          </nav>
          <div className="admin-sidebar-footer">
            <button onClick={() => navigate('menu')} className="admin-nav-btn" style={{ width: '100%', marginBottom: 8 }}>🌐 Visit Customer UI</button>
            <button onClick={handleAdminLogout} className="admin-nav-btn" style={{ width: '100%', color: 'var(--red)' }}>🚪 Logout</button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="admin-main">
          {adminView === 'dashboard' && (
            <div>
              <div className="admin-header">
                <h2>Dashboard Summary</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 'bold' }}>Store Status: </span>
                  <span className={`admin-badge ${settings?.shopOpen ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                    {settings?.shopOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                  <button onClick={toggleShopLive} className="admin-btn admin-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                    Toggle Status
                  </button>
                </div>
              </div>

              <div className="admin-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                <div className="admin-card" onClick={() => setAdminView('menu')} style={{ cursor: 'pointer' }}>
                  <div className="admin-card-icon" style={{ color: 'var(--gold)' }}>🍲</div>
                  <div className="admin-card-info">
                    <h4>Total Items</h4>
                    <p>{items.length}</p>
                  </div>
                </div>
                <div className="admin-card" onClick={() => setAdminView('orders')} style={{ cursor: 'pointer' }}>
                  <div className="admin-card-icon" style={{ color: 'var(--orange)' }}>📦</div>
                  <div className="admin-card-info">
                    <h4>Total Orders</h4>
                    <p>{adminOrders.length}</p>
                  </div>
                </div>
                <div className="admin-card" onClick={() => setAdminView('coupons')} style={{ cursor: 'pointer' }}>
                  <div className="admin-card-icon" style={{ color: 'var(--green)' }}>🏷️</div>
                  <div className="admin-card-info">
                    <h4>Active Coupons</h4>
                    <p>{adminCoupons.filter(c => c.isActive).length}</p>
                  </div>
                </div>
                <div className="admin-card" onClick={() => setAdminView('banners')} style={{ cursor: 'pointer' }}>
                  <div className="admin-card-icon" style={{ color: 'var(--red)' }}>🖼️</div>
                  <div className="admin-card-info">
                    <h4>Active Banners</h4>
                    <p>{adminBanners.filter(b => b.isActive).length}</p>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: 24, borderRadius: 'var(--radius-lg)' }}>
                <h3>Quick Actions & System Status</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
                  Welcome to the MoodFresher Administration Panel. Use the left sidebar to navigate and manage different parts of the platform.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button className="admin-btn admin-btn-primary" onClick={() => setAdminView('menu')}>Manage Menu Items</button>
                  <button className="admin-btn admin-btn-secondary" onClick={() => setAdminView('settings')}>Edit Operating Hours</button>
                </div>
              </div>
            </div>
          )}

          {adminView === 'orders' && (
            <div>
              <div className="admin-header">
                <h2>Manage Orders</h2>
                <button onClick={fetchAdminData} className="admin-btn admin-btn-secondary">
                  🔄 Refresh List
                </button>
              </div>

              {adminOrdersLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Loading orders list...
                </div>
              ) : adminOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No orders have been placed yet.
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Items Count</th>
                        <th>Total (₹)</th>
                        <th>Status</th>
                        <th>Order Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminOrders.map(order => (
                        <tr key={order._id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--gold-light)' }}>
                            {order.orderId}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{order.customerName}</td>
                          <td>{order.customerMobile}</td>
                          <td>{order.items.reduce((s, i) => s + i.qty, 0)}</td>
                          <td style={{ fontWeight: 'bold' }}>₹{order.total}</td>
                          <td>
                            <span className={`admin-badge status-${order.status.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="admin-btn admin-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => setSelectedAdminOrder(order)}
                            >
                              Details / Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {adminView === 'menu' && (
            <div>
              <div className="admin-header">
                <h2>Manage Menu Items</h2>
                <button onClick={() => openItemModal(null)} className="admin-btn admin-btn-primary">➕ Add New Item</button>
              </div>

              <div className="admin-table-container">
                <div className="admin-table-header-row">
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="form-control"
                    style={{ maxWidth: 300, padding: '6px 12px' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Showing {filteredAdminItems.length} items</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdminItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <img
                              src={photoMap[item.photoName] || item.photoName || brandLogo}
                              alt={item.itemName}
                              className="admin-table-img"
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 'bold' }}>{item.itemName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.description || 'No description'}</div>
                          </td>
                          <td>{item.category} {item.subcategory && <span style={{ fontSize: 11, padding: '2px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 3 }}>{item.subcategory}</span>}</td>
                          <td>
                            {item.hasHalfFull ? (
                              <span style={{ fontSize: 12 }}>
                                H: ₹{item.priceHalf} | F: ₹{item.priceFull}
                              </span>
                            ) : (
                              <span>₹{item.price}</span>
                            )}
                          </td>
                          <td>
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={item.isAvailable}
                                onChange={() => toggleItemAvailability(item)}
                              />
                              <span className="slider"></span>
                            </label>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => openItemModal(item)} className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>✏️ Edit</button>
                              <button onClick={() => deleteItem(item.id)} className="admin-btn admin-btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}>🗑️ Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminView === 'coupons' && (
            <div>
              <div className="admin-header">
                <h2>Manage Coupons & Promo Codes</h2>
                <button onClick={() => openCouponModal(null)} className="admin-btn admin-btn-primary">➕ Add Coupon</button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Discount %</th>
                      <th>Min Subtotal</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminCoupons.map(coupon => (
                      <tr key={coupon._id}>
                        <td><strong style={{ letterSpacing: 0.5, color: 'var(--gold-light)' }}>{coupon.code}</strong></td>
                        <td>{coupon.discountPercent}%</td>
                        <td>₹{coupon.minAmount}</td>
                        <td>{coupon.description || 'No description'}</td>
                        <td>
                          <span className={`admin-badge ${coupon.isActive ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                            {coupon.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openCouponModal(coupon)} className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>✏️ Edit</button>
                            <button onClick={() => deleteCoupon(coupon._id)} className="admin-btn admin-btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}>🗑️ Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {adminCoupons.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No coupons found. Click "Add Coupon" to create one.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminView === 'banners' && (
            <div>
              <div className="admin-header">
                <h2>Manage Offer Banners</h2>
                <button onClick={() => openBannerModal(null)} className="admin-btn admin-btn-primary">➕ Add Banner</button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Banner Image</th>
                      <th>Title & Description</th>
                      <th>Attached Coupon</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminBanners.map(banner => (
                      <tr key={banner._id}>
                        <td>
                          {banner.image ? (
                            <img src={banner.image} alt={banner.title} className="admin-table-img" style={{ width: 80, height: 50, borderRadius: 'var(--radius-sm)' }} />
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No image</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 'bold' }}>{banner.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{banner.description}</div>
                        </td>
                        <td>{banner.couponCode ? <span className="offer-coupon-badge" style={{ margin: 0 }}>{banner.couponCode}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}</td>
                        <td>
                          <span className={`admin-badge ${banner.isActive ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openBannerModal(banner)} className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}>✏️ Edit</button>
                            <button onClick={() => deleteBanner(banner._id)} className="admin-btn admin-btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}>🗑️ Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {adminBanners.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No promotional banners found. Add a banner to display on homepage.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminView === 'settings' && settings && (
            <div>
              <div className="admin-header">
                <h2>Store Settings & Controls</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {/* Store Parameters Form */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: 24, borderRadius: 'var(--radius-lg)' }}>
                  <h3>General Shop Parameters</h3>
                  <form onSubmit={handleSettingsUpdate} style={{ marginTop: 20 }}>
                    <div className="form-group">
                      <label>WhatsApp Number for Orders</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.whatsappNumber}
                        onChange={e => setSettings({ ...settings, whatsappNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Minimum Order Amount (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={settings.minOrderAmount}
                        onChange={e => setSettings({ ...settings, minOrderAmount: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Delivery Distance (km)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={settings.maxDeliveryDistance}
                        onChange={e => setSettings({ ...settings, maxDeliveryDistance: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>

                    <h4 style={{ marginTop: 24, marginBottom: 8, fontSize: 15 }}>⏰ Kitchen Operating Hours</h4>
                    <div className="checkbox-group" style={{ marginBottom: 12 }}>
                      <input
                        type="checkbox"
                        id="hours-enabled"
                        checked={settings.operatingHours.enabled}
                        onChange={e => setSettings({
                          ...settings,
                          operatingHours: { ...settings.operatingHours, enabled: e.target.checked }
                        })}
                      />
                      <label htmlFor="hours-enabled">Enable Operating Hours Check</label>
                    </div>

                    {settings.operatingHours.enabled && (
                      <>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Opening Time (24h)</label>
                            <input
                              type="time"
                              className="form-control"
                              value={settings.operatingHours.openTime}
                              onChange={e => setSettings({
                                ...settings,
                                operatingHours: { ...settings.operatingHours, openTime: e.target.value }
                              })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Closing Time (24h)</label>
                            <input
                              type="time"
                              className="form-control"
                              value={settings.operatingHours.closeTime}
                              onChange={e => setSettings({
                                ...settings,
                                operatingHours: { ...settings.operatingHours, closeTime: e.target.value }
                              })}
                            />
                          </div>
                        </div>

                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Working Days</label>
                        <div className="days-grid">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                            const isChecked = settings.operatingHours.days.includes(day)
                            return (
                              <div key={day} className="day-checkbox">
                                <input
                                  type="checkbox"
                                  id={`day-${day}`}
                                  checked={isChecked}
                                  onChange={e => {
                                    const updatedDays = e.target.checked
                                      ? [...settings.operatingHours.days, day]
                                      : settings.operatingHours.days.filter(d => d !== day)
                                    setSettings({
                                      ...settings,
                                      operatingHours: { ...settings.operatingHours, days: updatedDays }
                                    })
                                  }}
                                />
                                <label htmlFor={`day-${day}`}>{day.slice(0, 3)}</label>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}

                    <button type="submit" className="admin-btn admin-btn-primary" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
                      💾 Save Settings
                    </button>
                  </form>
                </div>

                {/* Change Admin Password */}
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: 24, borderRadius: 'var(--radius-lg)', height: 'fit-content' }}>
                  <h3>Change Administrator Password</h3>
                  <form onSubmit={handlePasswordChange} style={{ marginTop: 20 }}>
                    <div className="form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Current password"
                        value={passForm.oldPassword}
                        onChange={e => setPassForm({ ...passForm, oldPassword: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Min 6 characters"
                        value={passForm.newPassword}
                        onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Re-enter new password"
                        value={passForm.confirmPassword}
                        onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                        required
                      />
                    </div>
                    <button type="submit" className="admin-btn admin-btn-primary" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
                      🔑 Update Password
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
        {/* ── Admin Order Details Modal ── */}
        {selectedAdminOrder && (
          <div className="admin-modal-backdrop" onClick={() => setSelectedAdminOrder(null)}>
            <div className="admin-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Order Details — {selectedAdminOrder.orderId}</h3>
                <button className="admin-modal-close" onClick={() => setSelectedAdminOrder(null)}>&times;</button>
              </div>
              <div className="admin-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '24px' }}>
                
                {/* Status Update section */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Status:</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`admin-badge status-${selectedAdminOrder.status.toLowerCase()}`}>
                        {selectedAdminOrder.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Update Status:</label>
                    <select
                      className="form-control"
                      style={{ padding: '6px 12px', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer' }}
                      value={selectedAdminOrder.status}
                      onChange={e => handleUpdateOrderStatus(selectedAdminOrder.orderId, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Preparing">Preparing</option>
                      <option value="OutForDelivery">Out For Delivery</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Customer Details */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--gold-light)', borderBottom: '1px solid var(--border-default)', paddingBottom: '6px', marginBottom: '10px' }}>Customer Information</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 'bold' }}>{selectedAdminOrder.customerName}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Mobile:</span>
                      <p style={{ margin: '4px 0 0' }}>{selectedAdminOrder.customerMobile}</p>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Delivery Address:</span>
                      <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{selectedAdminOrder.customerAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--gold-light)', borderBottom: '1px solid var(--border-default)', paddingBottom: '6px', marginBottom: '10px' }}>Order Items</h4>
                  <table className="admin-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAdminOrder.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.name} {item.variant ? `(${item.variant})` : ''}</td>
                          <td style={{ textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>₹{item.qty * item.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div style={{ marginTop: '12px', paddingLeft: '40%', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                      <span>₹{selectedAdminOrder.subtotal}</span>
                    </div>
                    {selectedAdminOrder.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--green)' }}>
                        <span>Discount {selectedAdminOrder.couponCode ? `(${selectedAdminOrder.couponCode})` : ''}:</span>
                        <span>-₹{selectedAdminOrder.discount}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Delivery:</span>
                      <span>₹{selectedAdminOrder.deliveryFee}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-default)', fontWeight: 'bold', fontSize: '15px' }}>
                      <span>Total:</span>
                      <span style={{ color: 'var(--gold-light)' }}>₹{selectedAdminOrder.total}</span>
                    </div>
                  </div>
                </div>

                {/* Uploaded Invoice Image */}
                {selectedAdminOrder.imageUrl && (
                  <div>
                    <h4 style={{ color: 'var(--gold-light)', borderBottom: '1px solid var(--border-default)', paddingBottom: '6px', marginBottom: '10px' }}>Secure Invoice Image</h4>
                    <img
                      src={selectedAdminOrder.imageUrl}
                      alt="Invoice"
                      style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                      onClick={() => window.open(selectedAdminOrder.imageUrl, '_blank')}
                      title="Click to view full image in a new tab"
                    />
                  </div>
                )}

              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-secondary" onClick={() => setSelectedAdminOrder(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add/Edit Food Item Modal ── */}
        {itemModalOpen && (
          <div className="admin-modal-backdrop" onClick={() => setItemModalOpen(false)}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{editingItem ? 'Edit Food Item' : 'Add New Food Item'}</h3>
                <button className="admin-modal-close" onClick={() => setItemModalOpen(false)}>&times;</button>
              </div>
              <form onSubmit={saveItem}>
                <div className="admin-modal-body">
                  <div className="form-group">
                    <label>Food Item Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={itemForm.itemName}
                      onChange={e => setItemForm({ ...itemForm, itemName: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Category</label>
                      <select
                        className="form-control"
                        value={itemForm.category}
                        onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                      >
                        <option value="Chinese Combos">Chinese Combos</option>
                        <option value="Indian Combos">Indian Combos</option>
                        <option value="Chauchak Chaap">Chauchak Chaap</option>
                        <option value="Tagda Tikka">Tagda Tikka</option>
                        <option value="Chaap Specials">Chaap Specials</option>
                        <option value="Mazedaar Momo">Mazedaar Momo</option>
                        <option value="Raapchik Rolls">Raapchik Rolls</option>
                        <option value="Chinese">Chinese</option>
                        <option value="Thali">Thali</option>
                        <option value="Rice Bowls">Rice Bowls</option>
                        <option value="Desert">Desert</option>
                        <option value="Indian Gravy">Indian Gravy</option>
                        <option value="Dal">Dal</option>
                        <option value="Rice">Rice</option>
                        <option value="Breads">Breads</option>
                        <option value="Waffle Hut">Waffle Hut</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Subcategory (e.g. for Waffles)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={itemForm.subcategory}
                        onChange={e => setItemForm({ ...itemForm, subcategory: e.target.value })}
                        placeholder="Classic / Premium etc."
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      className="form-control"
                      value={itemForm.description}
                      onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                      rows="2"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Portion Weight / Size (e.g. 450g)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 400g / 2 Pieces"
                        value={itemForm.weight}
                        onChange={e => setItemForm({ ...itemForm, weight: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Quantity Breakdown (Portions)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 4 Chapati, 100g Paneer, 100g Rice"
                        value={itemForm.breakdown}
                        onChange={e => setItemForm({ ...itemForm, breakdown: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Pricing Switcher */}
                  <div className="checkbox-group" style={{ marginBottom: 16 }}>
                    <input
                      type="checkbox"
                      id="price-half-full"
                      checked={itemForm.hasHalfFull}
                      onChange={e => setItemForm({ ...itemForm, hasHalfFull: e.target.checked })}
                    />
                    <label htmlFor="price-half-full">Has Half & Full variants pricing</label>
                  </div>

                  {itemForm.hasHalfFull ? (
                    <div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Half Plate Discounted Price (₹)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={itemForm.priceHalf}
                            onChange={e => setItemForm({ ...itemForm, priceHalf: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Half Plate Original Price (₹ - Optional)</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="To show crossed-out price"
                            value={itemForm.originalPriceHalf}
                            onChange={e => setItemForm({ ...itemForm, originalPriceHalf: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Full Plate Discounted Price (₹)</label>
                          <input
                            type="number"
                            className="form-control"
                            value={itemForm.priceFull}
                            onChange={e => setItemForm({ ...itemForm, priceFull: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Full Plate Original Price (₹ - Optional)</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="To show crossed-out price"
                            value={itemForm.originalPriceFull}
                            onChange={e => setItemForm({ ...itemForm, originalPriceFull: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Discounted Price (₹)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={itemForm.price}
                          onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Original Price (₹ - Optional)</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="To show crossed-out price"
                          value={itemForm.originalPrice}
                          onChange={e => setItemForm({ ...itemForm, originalPrice: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Image Upload Widget */}
                  <div className="form-group">
                    <label>Food Item Photo</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Image URL or local resource filename"
                        value={itemForm.photoName}
                        onChange={e => setItemForm({ ...itemForm, photoName: e.target.value })}
                        required
                        style={{ flex: 1 }}
                      />
                      <label className="admin-btn admin-btn-secondary" style={{ margin: 0, padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        📤 Upload File
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handleUploadImage(e, url => setItemForm(prev => ({ ...prev, photoName: url })))}
                        />
                      </label>
                    </div>
                    {itemForm.photoName && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Image Preview:</span>
                        <br />
                        <img
                          src={photoMap[itemForm.photoName] || itemForm.photoName}
                          alt="Preview"
                          className="upload-widget-preview"
                          style={{ maxWidth: 80, height: 80, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button type="button" onClick={() => setItemModalOpen(false)} className="admin-btn admin-btn-secondary">Cancel</button>
                  <button type="submit" className="admin-btn admin-btn-primary">Save Item</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Add/Edit Coupon Modal ── */}
        {couponModalOpen && (
          <div className="admin-modal-backdrop" onClick={() => setCouponModalOpen(false)}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h3>
                <button className="admin-modal-close" onClick={() => setCouponModalOpen(false)}>&times;</button>
              </div>
              <form onSubmit={saveCoupon}>
                <div className="admin-modal-body">
                  <div className="form-group">
                    <label>Coupon Code (e.g. MOOD50)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={couponForm.code}
                      onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="UPPERCASE_ONLY"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Discount Percentage (%)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={couponForm.discountPercent}
                        onChange={e => setCouponForm({ ...couponForm, discountPercent: parseInt(e.target.value) || 0 })}
                        required
                        min="1"
                        max="100"
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Min Order Amount (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={couponForm.minAmount}
                        onChange={e => setCouponForm({ ...couponForm, minAmount: parseInt(e.target.value) || 0 })}
                        required
                        min="0"
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Set to 0 for no conditions (special clients).
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Coupon Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={couponForm.description}
                      onChange={e => setCouponForm({ ...couponForm, description: e.target.value })}
                      placeholder="e.g. Save 10% on your first order"
                    />
                  </div>
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="coupon-active"
                      checked={couponForm.isActive}
                      onChange={e => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                    />
                    <label htmlFor="coupon-active">Is Active & Redeemable</label>
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button type="button" onClick={() => setCouponModalOpen(false)} className="admin-btn admin-btn-secondary">Cancel</button>
                  <button type="submit" className="admin-btn admin-btn-primary">Save Coupon</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Add/Edit Banner Modal ── */}
        {bannerModalOpen && (
          <div className="admin-modal-backdrop" onClick={() => setBannerModalOpen(false)}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{editingBanner ? 'Edit Banner Component' : 'Create Offer Banner'}</h3>
                <button className="admin-modal-close" onClick={() => setBannerModalOpen(false)}>&times;</button>
              </div>
              <form onSubmit={saveBanner}>
                <div className="admin-modal-body">
                  <div className="form-group">
                    <label>Banner Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={bannerForm.title}
                      onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                      required
                      placeholder="e.g. Welcome Offer!"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description / Text</label>
                    <input
                      type="text"
                      className="form-control"
                      value={bannerForm.description}
                      onChange={e => setBannerForm({ ...bannerForm, description: e.target.value })}
                      placeholder="e.g. Save flat 20% on your next order using this special code."
                    />
                  </div>
                  <div className="form-group">
                    <label>Auto-apply Coupon Code (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={bannerForm.couponCode}
                      onChange={e => setBannerForm({ ...bannerForm, couponCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. MOOD20"
                    />
                  </div>

                  {/* Banner image upload */}
                  <div className="form-group">
                    <label>Banner Photo</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Image URL"
                        value={bannerForm.image}
                        onChange={e => setBannerForm({ ...bannerForm, image: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <label className="admin-btn admin-btn-secondary" style={{ margin: 0, padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        📤 Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handleUploadImage(e, url => setBannerForm(prev => ({ ...prev, image: url })))}
                        />
                      </label>
                    </div>
                    {bannerForm.image && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Banner Image Preview:</span>
                        <br />
                        <img
                          src={bannerForm.image}
                          alt="Banner Preview"
                          className="upload-widget-preview"
                          style={{ width: '100%', maxHeight: 150, borderRadius: 'var(--radius-md)', objectFit: 'cover', marginTop: 6 }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="banner-active"
                      checked={bannerForm.isActive}
                      onChange={e => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                    />
                    <label htmlFor="banner-active">Is Active (Displays on home screen)</label>
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button type="button" onClick={() => setBannerModalOpen(false)} className="admin-btn admin-btn-secondary">Cancel</button>
                  <button type="submit" className="admin-btn admin-btn-primary">Save Banner</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return view === 'admin' ? renderAdminView() : renderCustomerView()
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App