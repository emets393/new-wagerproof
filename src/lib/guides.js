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
})()
