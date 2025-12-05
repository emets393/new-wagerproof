import { Slot, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'react-native-drawer-layout';
import { useState, createContext, useContext } from 'react';
import { useTheme } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { useThemeContext } from '@/contexts/ThemeContext';
import SideMenu from '@/components/SideMenu';

const DrawerContext = createContext<{ open: () => void; close: () => void } | null>(null);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerLayout');
  }
  return context;
};

export default function DrawerLayout() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [open, setOpen] = useState(false);
  
  const handleOpen = () => {
    console.log('Opening drawer');
    setOpen(true);
  };
  
  const handleClose = () => {
    console.log('Closing drawer');
    setOpen(false);
  };
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DrawerContext.Provider value={{ open: handleOpen, close: handleClose }}>
        <Drawer
          open={open}
          onOpen={handleOpen}
          onClose={handleClose}
          drawerType="front"
          renderDrawerContent={() => (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={{ flex: 1, width: '100%' }}
            >
              <SideMenu onClose={handleClose} />
            </BlurView>
          )}
          drawerStyle={{
            backgroundColor: 'transparent',
            width: '80%',
          }}
          swipeEnabled={true}
          swipeEdgeWidth={50}
        >
          <Slot />
        </Drawer>
      </DrawerContext.Provider>
    </GestureHandlerRootView>
  );
}

