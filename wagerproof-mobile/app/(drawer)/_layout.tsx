import { Slot, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'react-native-drawer-layout';
import { useState, createContext, useContext } from 'react';
import { useTheme } from 'react-native-paper';
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
          renderDrawerContent={() => <SideMenu onClose={handleClose} />}
          drawerStyle={{
            backgroundColor: theme.colors.background,
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

