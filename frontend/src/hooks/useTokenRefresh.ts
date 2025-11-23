import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to automatically refresh access token before it expires
 * Access token expires in 15 minutes, we'll refresh at 14 minutes
 */
export const useTokenRefresh = () => {
  const { accessToken, refreshAccessToken, isAuthenticated } = useAuth();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      const refreshTime = timeUntilExpiry - 60000;

      if (refreshTime > 0) {
        console.log(`Token will be refreshed in ${Math.round(refreshTime / 1000)} seconds`);
        
        refreshTimerRef.current = setTimeout(async () => {
          console.log('Refreshing access token...');
          try {
            await refreshAccessToken();
            console.log('Access token refreshed successfully');
          } catch (error) {
            console.error('Failed to refresh token:', error);
          }
        }, refreshTime);
      } else {
        console.log('Token expired or expiring soon, refreshing now...');
        refreshAccessToken().catch(console.error);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [accessToken, isAuthenticated, refreshAccessToken]);
};
