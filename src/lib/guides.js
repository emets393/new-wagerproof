(() => {
  const root = document.documentElement
  const themeButton = document.querySelector('[data-theme-toggle]')

  function setTheme(theme) {
    root.dataset.theme = theme
    try {
      localStorage.setItem('wagerproof-guides-theme', theme)
    } catch {
      // The selected theme still applies for this page when storage is blocked.
    }
    if (themeButton) {
      themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`)
    }
  }

  if (themeButton) {
    setTheme(root.dataset.theme || 'light')
    themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'))
  }

  const search = document.querySelector('[data-guide-search]')
  if (search) {
    const searchScope = search.closest('.find-guides, .all-guides') || document
    const results = searchScope.querySelector('[data-guide-results]')
    const rows = results ? [...results.querySelectorAll('[data-guide-row]')] : []
    const empty = searchScope.querySelector('[data-guide-empty]')
    const groups = results ? [...results.querySelectorAll('.directory-group')] : []
    const update = () => {
      const query = search.value.trim().toLocaleLowerCase()
      let matches = 0
      for (const row of rows) {
        const visible = !query || row.dataset.search.includes(query)
        row.hidden = !visible
        if (visible) matches += 1
      }
      for (const group of groups) {
        group.hidden = ![...group.querySelectorAll('[data-guide-row]')].some((row) => !row.hidden)
      }
      if (empty) empty.hidden = matches !== 0
    }
    search.addEventListener('input', update)
  }

  const tocLinks = [...document.querySelectorAll('.article-toc a[href^="#"]')]
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]))
    const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean)
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        for (const link of tocLinks) link.removeAttribute('aria-current')
        byId.get(entry.target.id)?.setAttribute('aria-current', 'location')
      }
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 })
    for (const heading of headings) observer.observe(heading)
  }

  // Click-to-load YouTube facade. The static page links to youtube.com; with
  // JavaScript on, a privacy-enhanced youtube-nocookie.com player replaces it.
  for (const frame of document.querySelectorAll('[data-youtube-embed]')) {
    const link = frame.querySelector('a')
    const id = frame.dataset.youtubeId || ''
    if (!link || !/^[A-Za-z0-9_-]{11}$/.test(id)) continue
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      const player = document.createElement('iframe')
      player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
      player.title = frame.dataset.youtubeTitle || 'YouTube video'
      player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      player.referrerPolicy = 'strict-origin-when-cross-origin'
      player.allowFullscreen = true
      player.setAttribute('loading', 'eager')
      frame.replaceChildren(player)
      frame.classList.add('is-playing')
      player.focus()
    })
  }

  // Parlay calculator: progressive enhancement of the server-rendered form.
  // The math lives in src/lib/parlay-math.js and is inlined above this file
  // as the WagerProofParlayMath global by scripts/build-guides.mjs.
  const math = typeof WagerProofParlayMath === 'undefined' ? null : WagerProofParlayMath
  for (const form of math ? document.querySelectorAll('[data-parlay-calculator]') : []) {
    const list = form.querySelector('[data-pc-legs]')
    const addButton = form.querySelector('[data-pc-add]')
    const resetButton = form.querySelector('[data-pc-reset]')
    const countLabel = form.querySelector('[data-pc-count]')
    const formatSelect = form.querySelector('[data-pc-format]')
    const stakeInput = form.querySelector('[data-pc-stake]')
    const stakeMessage = form.querySelector('[data-pc-stake-msg]')
    const fairEmpty = form.querySelector('[data-pc-out="fairMessage"]')
    const fairResults = form.querySelector('[data-pc-fair-results]')
    const maxLegs = Number(form.dataset.maxLegs) || math.MAX_LEGS
    const minLegs = Number(form.dataset.minLegs) || math.MIN_LEGS
    const template = list.querySelector('[data-pc-leg]').cloneNode(true)
    const touched = new WeakSet()

    const rows = () => [...list.querySelectorAll('[data-pc-leg]')]

    function setMessage(input, message, element, show) {
      const visible = show ? message : ''
      element.textContent = visible
      if (visible) input.setAttribute('aria-invalid', 'true')
      else input.removeAttribute('aria-invalid')
    }

    function renumber() {
      const all = rows()
      all.forEach((row, index) => {
        const n = index + 1
        row.querySelector('[data-pc-leg-label]').textContent = `Leg ${n}`
        for (const key of ['odds', 'opposite']) {
          const input = row.querySelector(`[data-pc-${key}]`)
          const label = row.querySelector(`[data-pc-for="${key}"]`)
          const message = row.querySelector(`[data-pc-${key}-msg]`)
          input.id = `pc-${key}-${n}`
          label.htmlFor = input.id
          message.id = `${input.id}-msg`
          input.setAttribute('aria-describedby', message.id)
        }
        const remove = row.querySelector('[data-pc-remove]')
        remove.setAttribute('aria-label', `Remove leg ${n}`)
        remove.disabled = all.length <= minLegs
      })
      addButton.disabled = all.length >= maxLegs
      countLabel.textContent = `${all.length} of ${maxLegs} legs`
    }

    function update() {
      const all = rows()
      const state = {
        format: formatSelect.value,
        stake: stakeInput.value,
        legs: all.map((row) => ({
          odds: row.querySelector('[data-pc-odds]').value,
          opposite: row.querySelector('[data-pc-opposite]').value,
          void: row.querySelector('[data-pc-void]').checked,
        })),
      }
      const result = math.calculateParlay(state)
      const display = math.parlayDisplay(result)
      all.forEach((row, index) => {
        const leg = result.legs[index]
        const oddsInput = row.querySelector('[data-pc-odds]')
        const oppositeInput = row.querySelector('[data-pc-opposite]')
        const showOdds = !leg.void && !leg.odds.ok && (touched.has(oddsInput) || !leg.odds.empty)
        setMessage(oddsInput, leg.odds.error, row.querySelector('[data-pc-odds-msg]'), showOdds)
        setMessage(oppositeInput, leg.oppositeError, row.querySelector('[data-pc-opposite-msg]'), !leg.void && Boolean(leg.oppositeError))
        row.classList.toggle('is-void', leg.void)
        row.querySelector('[data-pc-leg-stats]').textContent = math.legStatsText(leg)
      })
      setMessage(stakeInput, result.stakeError, stakeMessage, Boolean(result.stakeError))
      for (const element of form.querySelectorAll('[data-pc-out]')) {
        const value = display[element.dataset.pcOut] || ''
        element.textContent = value
        if (element.dataset.pcOut === 'status') element.hidden = !value
      }
      fairEmpty.hidden = Boolean(display.fair)
      fairResults.hidden = !display.fair
      if (display.fair) {
        for (const element of form.querySelectorAll('[data-pc-fair-out]')) element.textContent = display.fair[element.dataset.pcFairOut] || ''
      }
      form.classList.toggle('is-invalid', !result.ready && result.status !== 'all-void')
    }

    function addLeg(values = {}) {
      if (rows().length >= maxLegs) return null
      const row = template.cloneNode(true)
      row.classList.remove('is-void')
      row.querySelector('[data-pc-odds]').value = values.odds || ''
      row.querySelector('[data-pc-opposite]').value = values.opposite || ''
      row.querySelector('[data-pc-void]').checked = Boolean(values.void)
      for (const message of row.querySelectorAll('.pc-msg')) message.textContent = ''
      row.querySelector('[data-pc-remove]').hidden = false
      list.append(row)
      renumber()
      return row
    }

    function reset() {
      for (const row of rows()) row.remove()
      for (const leg of math.PARLAY_DEFAULTS.legs) addLeg(leg)
      stakeInput.value = math.PARLAY_DEFAULTS.stake
      formatSelect.value = math.PARLAY_DEFAULTS.format
      update()
    }

    list.addEventListener('input', update)
    list.addEventListener('change', update)
    list.addEventListener('focusout', (event) => {
      if (event.target.matches('[data-pc-odds]')) {
        touched.add(event.target)
        update()
      }
    })
    list.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-pc-remove]')
      if (!remove || remove.disabled) return
      const row = remove.closest('[data-pc-leg]')
      const all = rows()
      const index = all.indexOf(row)
      row.remove()
      renumber()
      update()
      const next = rows()[Math.min(index, rows().length - 1)]
      next?.querySelector('[data-pc-odds]').focus()
    })
    addButton.addEventListener('click', () => {
      const row = addLeg()
      if (!row) return
      update()
      row.querySelector('[data-pc-odds]').focus()
    })
    resetButton.addEventListener('click', reset)
    formatSelect.addEventListener('change', update)
    stakeInput.addEventListener('input', update)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      update()
    })

    for (const button of form.querySelectorAll('[data-pc-remove], [data-pc-add], [data-pc-reset], [data-pc-count]')) button.hidden = false
    form.classList.add('is-enhanced')
    renumber()
    update()
  }
})()
