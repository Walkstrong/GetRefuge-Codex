import { useState, useEffect } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

export function useConnectivity(): boolean {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? false)
    })
    // Initial check
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false)
    })
    return () => unsubscribe()
  }, [])

  return isOnline
}
