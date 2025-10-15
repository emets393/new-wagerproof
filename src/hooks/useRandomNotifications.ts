
import { useEffect } from 'react';
import { toast } from 'sonner';
import { userImports } from '../data/fakeUserData';

export const useRandomNotifications = () => {
  useEffect(() => {
    const showRandomNotification = () => {
      const randomUser = userImports[Math.floor(Math.random() * userImports.length)];
      toast(`${randomUser.name} from ${randomUser.city} just signed up for WagerProof!`, {
        duration: 4000,
      });
    };

    const scheduleNextNotification = () => {
      const randomDelay = Math.floor(Math.random() * (35000 - 5000) + 5000); // Random delay between 5-35 seconds
      return setTimeout(() => {
        showRandomNotification();
        timeoutId = scheduleNextNotification();
      }, randomDelay);
    };

    let timeoutId = scheduleNextNotification();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);
};
