import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_MIN_BREAKPOINT = 768
const TABLET_MAX_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth
      const isTabletSize = width >= TABLET_MIN_BREAKPOINT && width <= TABLET_MAX_BREAKPOINT
      setIsTablet(isTabletSize)
    }

    const mql = window.matchMedia(`(min-width: ${TABLET_MIN_BREAKPOINT}px) and (max-width: ${TABLET_MAX_BREAKPOINT}px)`)
    mql.addEventListener("change", checkTablet)
    checkTablet()
    return () => mql.removeEventListener("change", checkTablet)
  }, [])

  return !!isTablet
}

export function useIsIPad() {
  const [isIPad, setIsIPad] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const detectIPad = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isIOS = /ipad|iphone|ipod/.test(userAgent)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isTabletSize = window.innerWidth >= 768 && window.innerWidth <= 1024
      
      // Modern iPad detection (iOS 13+ reports as desktop Safari)
      const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
      
      setIsIPad((isIOS && isTabletSize) || isModernIPad || (isTouchDevice && isTabletSize && /safari/i.test(userAgent)))
    }

    detectIPad()
    window.addEventListener('resize', detectIPad)
    return () => window.removeEventListener('resize', detectIPad)
  }, [])

  return !!isIPad
}

export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  React.useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth
      const userAgent = navigator.userAgent.toLowerCase()
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Modern iPad detection
      const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
      
      if (width < 768) {
        setDeviceType('mobile')
      } else if (width <= 1024 && (isTouchDevice || isModernIPad || /ipad|tablet|android/i.test(userAgent))) {
        setDeviceType('tablet')
      } else {
        setDeviceType('desktop')
      }
    }

    detectDevice()
    window.addEventListener('resize', detectDevice)
    return () => window.removeEventListener('resize', detectDevice)
  }, [])

  return deviceType
}

export function useIOSVersion() {
  const [iosVersion, setIOSVersion] = React.useState<number | null>(null)

  React.useEffect(() => {
    const userAgent = navigator.userAgent
    const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)
    
    if (match) {
      const majorVersion = parseInt(match[1], 10)
      setIOSVersion(majorVersion)
    }
  }, [])

  return iosVersion
}
