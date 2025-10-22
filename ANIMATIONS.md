# Wagerproof Mobile Animation Reference Guide

## Table of Contents
1. [Introduction & Purpose](#introduction--purpose)
2. [General Best Practices](#general-best-practices)
3. [React Native Reanimated 3](#react-native-reanimated-3)
4. [Moti](#moti)
5. [React-Spring](#react-spring)
6. [React Marquee](#react-marquee)
7. [React-Native-Skia](#react-native-skia)
8. [Decision Matrix](#decision-matrix)
9. [Common Patterns Library](#common-patterns-library)
10. [Performance Guidelines](#performance-guidelines)
11. [Implementation Checklist](#implementation-checklist)

---

## Introduction & Purpose

### Why Smooth Animations Matter

Smooth animations are critical for creating a premium user experience in mobile applications. They:
- **Enhance perceived performance**: Well-executed animations make the app feel faster and more responsive
- **Guide user attention**: Direct users' focus to important changes and interactions
- **Provide feedback**: Confirm user actions and system state changes
- **Create delight**: Polished animations differentiate your app from competitors
- **Improve usability**: Help users understand spatial relationships and navigation

### Performance Targets

**60 FPS (16.67ms per frame)** is the gold standard for smooth animations on most devices. For high refresh rate displays (120Hz):
- Target **120 FPS (8.33ms per frame)** when possible
- Always maintain **minimum 60 FPS** even on older devices
- Monitor **dropped frames** during testing

### When to Animate vs When Not To

**DO Animate:**
- Screen transitions and navigation
- Loading states and progress indicators
- User interaction feedback (button presses, toggles)
- Content reveals and dismissals
- Attention-directing changes
- Micro-interactions that add delight

**DON'T Animate:**
- Critical information updates (scores, stats) that need immediate visibility
- Text-heavy content reading experiences
- When users have reduced motion preferences enabled
- Rapid successive state changes (can cause animation conflicts)
- During performance-critical operations

---

## General Best Practices

### Animation Duration Guidelines

```typescript
const ANIMATION_DURATIONS = {
  instant: 0,
  fast: 150,      // Micro-interactions, hover states
  normal: 250,    // Default for most animations
  slow: 350,      // Screen transitions
  slower: 500,    // Complex multi-element animations
  slowest: 750,   // Special attention-grabbing animations
};
```

### Easing Functions

Choose appropriate easing for natural motion:

- **Linear**: Constant speed (rarely used, feels mechanical)
- **Ease-in**: Starts slow, accelerates (good for exits)
- **Ease-out**: Starts fast, decelerates (good for entrances) - **MOST COMMON**
- **Ease-in-out**: Slow start and end (good for attention-grabbing)
- **Spring**: Physics-based (feels most natural)

### Common Pitfalls to Avoid

1. **Don't animate layout properties without caution**: Width, height, and layout operations can trigger expensive re-layouts
2. **Avoid animating multiple properties simultaneously**: Unless necessary, animate one property at a time for clarity
3. **Don't over-animate**: Too many animations create visual noise
4. **Never block user interaction**: Animations should never prevent users from taking action
5. **Avoid animating expensive operations**: Keep animations on transform and opacity when possible
6. **Don't forget cleanup**: Always clean up animation listeners and timers

### Accessibility Considerations

Always respect user preferences:

```typescript
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// Check for reduced motion preference
const reducedMotion = useReducedMotion();

// Adjust animations accordingly
const animationDuration = reducedMotion ? 0 : ANIMATION_DURATIONS.normal;
```

---

## React Native Reanimated 3

### Overview

**React Native Reanimated** is the primary animation library for this project. It runs animations on the native UI thread, ensuring smooth 60fps performance even during heavy JavaScript operations.

**Official Documentation**: https://docs.swmansion.com/react-native-reanimated/

### When to Use Reanimated

- ✅ Complex gesture-based interactions
- ✅ High-performance scrolling effects
- ✅ Coordinated multi-element animations
- ✅ Animations that need to run while JS thread is busy
- ✅ Advanced interpolations and transformations

### Key Concepts

#### Shared Values

Shared values are the core of Reanimated. They hold animated values that can be accessed from both JS and UI threads.

```typescript
import { useSharedValue, withSpring } from 'react-native-reanimated';

function MyComponent() {
  const offset = useSharedValue(0);
  
  const handlePress = () => {
    offset.value = withSpring(100);
  };
}
```

#### Worklets

Worklets are JavaScript functions that can run on the UI thread. Mark them with `'worklet'` directive.

```typescript
const myWorklet = (value: number) => {
  'worklet';
  return value * 2;
};
```

#### Animated Styles

Use `useAnimatedStyle` to create animated style objects:

```typescript
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  withTiming 
} from 'react-native-reanimated';

function FadeIn() {
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });
  
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
  }, []);
  
  return <Animated.View style={animatedStyle}>...</Animated.View>;
}
```

### Common Patterns

#### Fade Animation

```typescript
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing 
} from 'react-native-reanimated';

function FadeInView({ children, duration = 300 }) {
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(opacity.value, {
      duration,
      easing: Easing.out(Easing.quad),
    }),
  }));
  
  useEffect(() => {
    opacity.value = 1;
  }, []);
  
  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
```

#### Slide Animation

```typescript
function SlideInView({ children, fromLeft = true }) {
  const translateX = useSharedValue(fromLeft ? -100 : 100);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(translateX.value, {
          damping: 20,
          stiffness: 90,
        }),
      },
    ],
  }));
  
  useEffect(() => {
    translateX.value = 0;
  }, []);
  
  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
```

#### Scale Animation (Bounce Effect)

```typescript
function BounceButton({ onPress, children }) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 10 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10 });
  };
  
  return (
    <Animated.View style={animatedStyle}>
      <Pressable 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
```

#### Gesture-Based Animation

```typescript
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

function DraggableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const gesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));
  
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        {/* Card content */}
      </Animated.View>
    </GestureDetector>
  );
}
```

#### Scroll-Based Animation

```typescript
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';

function ParallaxHeader() {
  const scrollY = useSharedValue(0);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  
  const headerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, -50],
      'clamp'
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      'clamp'
    );
    
    return {
      transform: [{ translateY }],
      opacity,
    };
  });
  
  return (
    <>
      <Animated.View style={[styles.header, headerStyle]}>
        {/* Header content */}
      </Animated.View>
      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
        {/* Scrollable content */}
      </Animated.ScrollView>
    </>
  );
}
```

### Performance Tips

1. **Use `withTiming` for simple animations**: It's more performant than spring for basic transitions
2. **Memoize worklets**: Use `useMemo` for expensive worklet calculations
3. **Avoid reading from shared values in render**: Only read in animated styles or worklets
4. **Use `runOnJS` sparingly**: Minimize cross-thread communication
5. **Batch updates**: Update multiple shared values in one function when possible

```typescript
// ❌ Bad: Multiple separate updates
const handlePress = () => {
  scale.value = withSpring(1.2);
  opacity.value = withTiming(0.8);
  rotate.value = withTiming(45);
};

// ✅ Good: Batched in animation timing
const animatedStyle = useAnimatedStyle(() => ({
  transform: [
    { scale: scale.value },
    { rotate: `${rotate.value}deg` },
  ],
  opacity: opacity.value,
}));
```

---

## Moti

### Overview

**Moti** is a universal animation library built on top of Reanimated 3, offering a simpler, more declarative API. It's perfect for common animations without the complexity of raw Reanimated.

**Official Documentation**: https://moti.fyi/

### When to Use Moti

- ✅ Simple fade/slide/scale animations
- ✅ Sequential animations and loops
- ✅ Mount/unmount animations
- ✅ Variant-based animation systems
- ✅ When you want cleaner code than raw Reanimated

### Benefits Over Raw Reanimated

1. **Declarative API**: Define animations in props instead of hooks
2. **Built-in variants**: Easy state-based animations
3. **Automatic cleanup**: No need to manage cleanup manually
4. **Sequence support**: Chain animations easily
5. **Loop support**: Built-in infinite animations

### Variant System

Variants allow you to define different animation states:

```typescript
import { MotiView } from 'moti';

function AnimatedButton() {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <MotiView
      animate={isPressed ? 'pressed' : 'idle'}
      variants={{
        idle: {
          scale: 1,
          backgroundColor: '#3b82f6',
        },
        pressed: {
          scale: 0.95,
          backgroundColor: '#2563eb',
        },
      }}
      transition={{
        type: 'spring',
        damping: 15,
      }}
    >
      {/* Button content */}
    </MotiView>
  );
}
```

### Sequences

Create sequential animations easily:

```typescript
import { MotiView } from 'moti';

function SequentialAnimation() {
  return (
    <MotiView
      from={{
        opacity: 0,
        scale: 0,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        type: 'timing',
        duration: 350,
        delay: 100,
      }}
    />
  );
}
```

### Loops

Create infinite looping animations:

```typescript
import { MotiView } from 'moti';

function PulsingDot() {
  return (
    <MotiView
      from={{
        scale: 1,
        opacity: 1,
      }}
      animate={{
        scale: 1.2,
        opacity: 0.5,
      }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
        repeatReverse: true,
      }}
      style={styles.dot}
    />
  );
}
```

### Mount/Unmount Animations

Moti automatically handles enter/exit animations:

```typescript
import { AnimatePresence, MotiView } from 'moti';

function ConditionalContent({ visible, children }) {
  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{
            opacity: 0,
            translateY: -20,
          }}
          animate={{
            opacity: 1,
            translateY: 0,
          }}
          exit={{
            opacity: 0,
            translateY: 20,
          }}
          transition={{
            type: 'timing',
            duration: 250,
          }}
        >
          {children}
        </MotiView>
      )}
    </AnimatePresence>
  );
}
```

### Common Patterns

#### Loading Skeleton

```typescript
import { MotiView } from 'moti';

function SkeletonLoader() {
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
        repeatReverse: true,
      }}
      style={styles.skeleton}
    />
  );
}
```

#### Staggered List Animation

```typescript
import { MotiView } from 'moti';

function StaggeredList({ items }) {
  return (
    <>
      {items.map((item, index) => (
        <MotiView
          key={item.id}
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'spring',
            delay: index * 100, // Stagger by 100ms
            damping: 15,
          }}
        >
          <ListItem item={item} />
        </MotiView>
      ))}
    </>
  );
}
```

#### Animated Counter

```typescript
import { MotiText } from 'moti';
import { useEffect, useState } from 'react';

function AnimatedCounter({ value }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);
  
  return (
    <MotiText
      animate={{ scale: [1, 1.2, 1] }}
      transition={{
        type: 'spring',
        damping: 15,
      }}
    >
      {displayValue}
    </MotiText>
  );
}
```

---

## React-Spring

### Overview

**React-Spring** is a spring-physics-based animation library that works for both React and React Native. It excels at creating natural, physics-based motion.

**Official Documentation**: https://react-spring.dev/

### When to Use React-Spring

- ✅ Physics-based animations (realistic motion)
- ✅ Gesture-driven interactions with momentum
- ✅ Complex multi-stage animations
- ✅ When coming from web React background
- ⚠️ Note: Has some performance limitations vs Reanimated on complex animations

### Spring Physics Concepts

Springs are defined by:
- **Mass**: Weight of the object (higher = slower)
- **Tension**: Spring tightness (higher = faster)
- **Friction**: Resistance (higher = less bouncy)

```typescript
const config = {
  mass: 1,
  tension: 180,
  friction: 12,
};
```

### Common Patterns

#### Basic Spring Animation

```typescript
import { useSpring, animated } from '@react-spring/native';

function SpringAnimation() {
  const [isOpen, setIsOpen] = useState(false);
  
  const animation = useSpring({
    opacity: isOpen ? 1 : 0,
    transform: [
      { scale: isOpen ? 1 : 0.8 },
    ],
    config: {
      tension: 180,
      friction: 12,
    },
  });
  
  return (
    <animated.View style={animation}>
      {/* Content */}
    </animated.View>
  );
}
```

#### Gesture with Momentum

```typescript
import { useSpring, animated } from '@react-spring/native';
import { PanGestureHandler } from 'react-native-gesture-handler';

function DraggableView() {
  const [{ x, y }, api] = useSpring(() => ({
    x: 0,
    y: 0,
  }));
  
  const handleGesture = (event) => {
    api.start({
      x: event.nativeEvent.translationX,
      y: event.nativeEvent.translationY,
      immediate: true,
    });
  };
  
  const handleRelease = () => {
    api.start({
      x: 0,
      y: 0,
      config: { tension: 200, friction: 20 },
    });
  };
  
  return (
    <PanGestureHandler
      onGestureEvent={handleGesture}
      onHandlerStateChange={handleRelease}
    >
      <animated.View
        style={{
          transform: [
            { translateX: x },
            { translateY: y },
          ],
        }}
      >
        {/* Content */}
      </animated.View>
    </PanGestureHandler>
  );
}
```

#### Trail Animation (Staggered)

```typescript
import { useTrail, animated } from '@react-spring/native';

function TrailAnimation({ items }) {
  const trail = useTrail(items.length, {
    from: { opacity: 0, transform: [{ translateY: 20 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
    config: { tension: 200, friction: 20 },
  });
  
  return (
    <>
      {trail.map((style, index) => (
        <animated.View key={items[index].id} style={style}>
          <Item data={items[index]} />
        </animated.View>
      ))}
    </>
  );
}
```

### Integration Considerations

- React-Spring uses its own `animated` components
- May have slightly lower performance than Reanimated for complex animations
- Better for web/native code sharing if building for both platforms
- Great documentation and community support

---

## React Marquee

### Overview

**React Marquee** (or react-fast-marquee) provides smooth scrolling marquee effects for text and content. Perfect for tickers, news feeds, and scrolling stats.

**Popular Package**: `react-fast-marquee` (for web) or `react-native-marquee` for native

### When to Use

- ✅ Sports score tickers
- ✅ News/updates feed
- ✅ Scrolling statistics
- ✅ Promotional banners
- ✅ Any continuous scrolling content

### Configuration Options

```typescript
import Marquee from 'react-native-marquee';

function TickerMarquee() {
  return (
    <Marquee
      speed={50}              // Pixels per second
      spacing={20}            // Space between repetitions
      marqueeOnMount={true}   // Start immediately
      loop={true}             // Infinite loop
      delay={0}              // Start delay in ms
    >
      Latest Scores: Lakers 102 - Warriors 98 | Bulls 87 - Heat 92
    </Marquee>
  );
}
```

### Use Cases

#### Live Score Ticker

```typescript
import Marquee from 'react-native-marquee';
import { View, Text } from 'react-native';

function LiveScoreTicker({ games }) {
  const tickerContent = games.map(game => 
    `${game.homeTeam} ${game.homeScore} - ${game.awayScore} ${game.awayTeam}`
  ).join('  |  ');
  
  return (
    <View style={styles.tickerContainer}>
      <Marquee
        speed={40}
        spacing={50}
        marqueeOnMount={true}
        loop={true}
      >
        <Text style={styles.tickerText}>{tickerContent}</Text>
      </Marquee>
    </View>
  );
}
```

#### Promotional Banner

```typescript
function PromoBanner({ message }) {
  return (
    <View style={styles.banner}>
      <Marquee
        speed={30}
        spacing={200}
        marqueeOnMount={true}
        loop={true}
      >
        <View style={styles.promoContent}>
          <Icon name="star" />
          <Text style={styles.promoText}>{message}</Text>
          <Icon name="star" />
        </View>
      </Marquee>
    </View>
  );
}
```

#### Scrolling Stats

```typescript
function ScrollingStats({ stats }) {
  return (
    <Marquee
      speed={35}
      spacing={100}
      marqueeOnMount={true}
    >
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.stat}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </Marquee>
  );
}
```

### Best Practices

1. **Keep content concise**: Long content can be hard to read
2. **Appropriate speed**: Not too fast (hard to read) or too slow (boring)
3. **Sufficient spacing**: Prevent content from feeling cramped
4. **Pause on interaction**: Consider pausing when user taps
5. **Accessibility**: Provide alternative way to view content

---

## React-Native-Skia

### Overview

**React-Native-Skia** brings the Skia Graphics Library to React Native, enabling complex 2D graphics and animations. It's the most powerful option for custom graphics and effects.

**Official Documentation**: https://shopify.github.io/react-native-skia/

### When to Use Skia

- ✅ Complex custom graphics
- ✅ Chart animations
- ✅ Particle effects
- ✅ Custom drawing and paths
- ✅ Advanced gradients and effects
- ✅ High-performance rendering of many elements
- ⚠️ Requires more expertise than other options

### Capabilities

Skia provides low-level graphics APIs:
- Paths and shapes
- Gradients and shaders
- Image filters and effects
- Text rendering
- Blend modes
- Clipping and masking

### Integration with Reanimated

Skia works seamlessly with Reanimated for animated graphics:

```typescript
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

function AnimatedCircle() {
  const radius = useSharedValue(20);
  
  useEffect(() => {
    radius.value = withRepeat(
      withTiming(40, { duration: 1000 }),
      -1,
      true
    );
  }, []);
  
  return (
    <Canvas style={{ width: 100, height: 100 }}>
      <Circle cx={50} cy={50} r={radius} color="blue" />
    </Canvas>
  );
}
```

### Basic Examples

#### Animated Progress Circle

```typescript
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming } from 'react-native-reanimated';

function ProgressCircle({ progress }) {
  const animatedProgress = useSharedValue(0);
  
  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 500 });
  }, [progress]);
  
  const path = Skia.Path.Make();
  path.addCircle(50, 50, 40);
  
  return (
    <Canvas style={{ width: 100, height: 100 }}>
      {/* Background circle */}
      <Circle cx={50} cy={50} r={40} color="#e5e7eb" style="stroke" strokeWidth={8} />
      
      {/* Progress circle */}
      <Path
        path={path}
        color="#3b82f6"
        style="stroke"
        strokeWidth={8}
        strokeCap="round"
        start={0}
        end={animatedProgress}
      />
    </Canvas>
  );
}
```

#### Particle Effect

```typescript
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, withDelay } from 'react-native-reanimated';

function ParticleEffect() {
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: useSharedValue(50),
      y: useSharedValue(50),
      opacity: useSharedValue(1),
    }))
  , []);
  
  useEffect(() => {
    particles.forEach((particle, i) => {
      const angle = (i / particles.length) * Math.PI * 2;
      const distance = 100;
      
      particle.x.value = withDelay(
        i * 50,
        withTiming(50 + Math.cos(angle) * distance, { duration: 1000 })
      );
      
      particle.y.value = withDelay(
        i * 50,
        withTiming(50 + Math.sin(angle) * distance, { duration: 1000 })
      );
      
      particle.opacity.value = withDelay(
        i * 50,
        withTiming(0, { duration: 1000 })
      );
    });
  }, []);
  
  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <Group>
        {particles.map(particle => (
          <Circle
            key={particle.id}
            cx={particle.x}
            cy={particle.y}
            r={4}
            color="blue"
            opacity={particle.opacity}
          />
        ))}
      </Group>
    </Canvas>
  );
}
```

#### Animated Gradient Background

```typescript
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

function AnimatedGradientBackground() {
  const gradientPosition = useSharedValue(0);
  
  useEffect(() => {
    gradientPosition.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      true
    );
  }, []);
  
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={['#3b82f6', '#8b5cf6', '#ec4899']}
          positions={[0, gradientPosition, 1]}
        />
      </Rect>
    </Canvas>
  );
}
```

### Performance Considerations

1. **Use canvas efficiently**: Skia is fast, but unnecessary re-renders can hurt performance
2. **Memoize paths**: Create paths once and reuse them
3. **Batch operations**: Group related drawing operations
4. **Use appropriate precision**: Don't over-complicate paths
5. **Profile performance**: Use React DevTools to identify bottlenecks

---

## Decision Matrix

### Library Selection Guide

| Use Case | Recommended Library | Alternative | Complexity |
|----------|-------------------|-------------|------------|
| Simple fade/slide/scale | Moti | Reanimated | Low |
| Button press feedback | Moti | Reanimated | Low |
| Screen transitions | Reanimated | Moti | Medium |
| Gesture-based interactions | Reanimated | React-Spring | Medium-High |
| Scroll-based animations | Reanimated | - | Medium |
| Sequential/staggered animations | Moti | React-Spring | Low-Medium |
| Loading indicators | Moti | Reanimated | Low |
| Score tickers | React Marquee | Custom with Reanimated | Low |
| Physics-based motion | React-Spring | Reanimated (spring) | Medium |
| Complex graphics | Skia | - | High |
| Charts and data viz | Skia | Victory Native | High |
| Particle effects | Skia | - | High |
| Custom drawing | Skia | - | High |

### Performance Comparison

| Library | Performance | Learning Curve | Flexibility | Bundle Size |
|---------|------------|----------------|-------------|-------------|
| Reanimated 3 | ⭐⭐⭐⭐⭐ | Medium | ⭐⭐⭐⭐⭐ | Medium |
| Moti | ⭐⭐⭐⭐⭐ | Low | ⭐⭐⭐⭐ | Small |
| React-Spring | ⭐⭐⭐⭐ | Medium | ⭐⭐⭐⭐ | Medium |
| React Marquee | ⭐⭐⭐⭐ | Very Low | ⭐⭐ | Very Small |
| Skia | ⭐⭐⭐⭐⭐ | High | ⭐⭐⭐⭐⭐ | Large |

### Complexity vs Capability Trade-offs

```
High Capability
    ↑
    │         Skia
    │           ●
    │      
    │  Reanimated
    │      ●
    │             React-Spring
    │                ●
    │  Moti
    │   ●    
    │        React Marquee
    │            ●
    │
    └──────────────────────────→ High Complexity
Low                            
```

**General Rule**: Start with Moti for simple animations, graduate to Reanimated for complex interactions, and use Skia only when you need custom graphics.

---

## Common Patterns Library

### Screen Transitions

#### Slide from Right (iOS-style)

```typescript
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

function SlideFromRight({ children }) {
  const translateX = useSharedValue(width);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  useEffect(() => {
    translateX.value = withTiming(0, { duration: 300 });
  }, []);
  
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
```

#### Fade with Scale (Modal)

```typescript
import { MotiView } from 'moti';

function ModalTransition({ visible, children }) {
  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{
            opacity: 0,
            scale: 0.9,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0.9,
          }}
          transition={{
            type: 'timing',
            duration: 200,
          }}
        >
          {children}
        </MotiView>
      )}
    </AnimatePresence>
  );
}
```

### List Item Animations

#### Swipe to Delete

```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

function SwipeableListItem({ item, onDelete }) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -100;
  
  const gesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withSpring(-width);
        runOnJS(onDelete)(item.id);
      } else {
        translateX.value = withSpring(0);
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, DELETE_THRESHOLD],
      [0, 1],
      'clamp'
    ),
  }));
  
  return (
    <View>
      <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
        <Text>Delete</Text>
      </Animated.View>
      
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.item, animatedStyle]}>
          {/* Item content */}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
```

#### Staggered Fade-In

```typescript
import { MotiView } from 'moti';

function StaggeredList({ items }) {
  return (
    <FlatList
      data={items}
      renderItem={({ item, index }) => (
        <MotiView
          from={{ opacity: 0, translateY: 50 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'timing',
            duration: 500,
            delay: index * 100,
          }}
        >
          <ListItem item={item} />
        </MotiView>
      )}
    />
  );
}
```

### Loading States

#### Skeleton Loader

```typescript
import { MotiView } from 'moti';

function SkeletonLoader({ width = '100%', height = 20 }) {
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
        repeatReverse: true,
      }}
      style={{
        width,
        height,
        backgroundColor: '#e5e7eb',
        borderRadius: 4,
      }}
    />
  );
}
```

#### Spinner with Scale

```typescript
import { MotiView } from 'moti';

function LoadingSpinner() {
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={{ rotate: '360deg' }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
      }}
    >
      <ActivityIndicator />
    </MotiView>
  );
}
```

#### Pulsing Dots

```typescript
function PulsingDots() {
  return (
    <View style={styles.dotsContainer}>
      {[0, 1, 2].map((index) => (
        <MotiView
          key={index}
          from={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0.3 }}
          transition={{
            type: 'timing',
            duration: 600,
            delay: index * 200,
            loop: true,
            repeatReverse: true,
          }}
          style={styles.dot}
        />
      ))}
    </View>
  );
}
```

### Micro-Interactions

#### Button Press Scale

```typescript
import { MotiPressable } from 'moti/interactions';

function ScaleButton({ onPress, children }) {
  return (
    <MotiPressable
      onPress={onPress}
      animate={({ pressed }) => ({
        scale: pressed ? 0.95 : 1,
      })}
      transition={{
        type: 'spring',
        damping: 15,
      }}
    >
      {children}
    </MotiPressable>
  );
}
```

#### Toggle Switch

```typescript
function AnimatedToggle({ value, onToggle }) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleContainer}>
      <MotiView
        animate={{
          backgroundColor: value ? '#3b82f6' : '#d1d5db',
        }}
        transition={{
          type: 'timing',
          duration: 200,
        }}
        style={styles.toggleTrack}
      >
        <MotiView
          animate={{
            translateX: value ? 20 : 0,
          }}
          transition={{
            type: 'spring',
            damping: 15,
          }}
          style={styles.toggleThumb}
        />
      </MotiView>
    </Pressable>
  );
}
```

#### Checkbox Check Animation

```typescript
import { MotiView } from 'moti';

function AnimatedCheckbox({ checked, onToggle }) {
  return (
    <Pressable onPress={onToggle}>
      <MotiView
        animate={{
          backgroundColor: checked ? '#3b82f6' : 'transparent',
          borderColor: checked ? '#3b82f6' : '#d1d5db',
        }}
        transition={{
          type: 'timing',
          duration: 200,
        }}
        style={styles.checkbox}
      >
        {checked && (
          <MotiView
            from={{ scale: 0, rotate: '-45deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            transition={{
              type: 'spring',
              damping: 10,
            }}
          >
            <Icon name="check" color="white" size={16} />
          </MotiView>
        )}
      </MotiView>
    </Pressable>
  );
}
```

### Card Animations

#### Flip Card

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

function FlipCard({ front, back }) {
  const rotation = useSharedValue(0);
  
  const flipCard = () => {
    rotation.value = withTiming(rotation.value + 180, { duration: 600 });
  };
  
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180]);
    const opacity = interpolate(rotation.value, [0, 90, 180], [1, 0, 0]);
    
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  });
  
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [180, 360]);
    const opacity = interpolate(rotation.value, [0, 90, 180], [0, 0, 1]);
    
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  });
  
  return (
    <Pressable onPress={flipCard}>
      <Animated.View style={[styles.card, frontAnimatedStyle]}>
        {front}
      </Animated.View>
      <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
        {back}
      </Animated.View>
    </Pressable>
  );
}
```

#### Expand/Collapse Card

```typescript
import { MotiView } from 'moti';
import { useState } from 'react';

function ExpandableCard({ title, children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <View>
      <Pressable onPress={() => setIsExpanded(!isExpanded)}>
        <View style={styles.cardHeader}>
          <Text>{title}</Text>
          <MotiView
            animate={{ rotate: isExpanded ? '180deg' : '0deg' }}
            transition={{ type: 'timing', duration: 200 }}
          >
            <Icon name="chevron-down" />
          </MotiView>
        </View>
      </Pressable>
      
      <MotiView
        animate={{
          height: isExpanded ? 'auto' : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{
          type: 'timing',
          duration: 300,
        }}
      >
        <View style={styles.cardContent}>
          {children}
        </View>
      </MotiView>
    </View>
  );
}
```

### Modal Presentations

#### Bottom Sheet Modal

```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

function BottomSheet({ visible, onClose, children }) {
  const translateY = useSharedValue(height);
  
  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : height, {
      damping: 50,
      stiffness: 200,
    });
  }, [visible]);
  
  const gesture = Gesture.Pan()
    .onChange((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        translateY.value = withSpring(height);
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  
  if (!visible) return null;
  
  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.bottomSheet, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );
}
```

---

## Performance Guidelines

### Measuring Animation Performance

#### Enable Performance Monitor

```typescript
// In development, enable perf monitor
if (__DEV__) {
  import('react-native').then(({ PerformanceMonitor }) => {
    PerformanceMonitor.enablePerfMonitor();
  });
}
```

#### Use React DevTools Profiler

1. Open React DevTools
2. Go to Profiler tab
3. Record while testing animations
4. Look for:
   - Long render times (>16ms)
   - Unnecessary re-renders
   - Heavy JavaScript operations during animations

#### Monitor Frame Drops

```typescript
import { useCallback } from 'react';

function useFrameCallback(callback) {
  const stableCallback = useCallback(callback, []);
  
  useEffect(() => {
    const frameId = requestAnimationFrame(stableCallback);
    return () => cancelAnimationFrame(frameId);
  }, [stableCallback]);
}
```

### Optimization Techniques

#### 1. Use Native Driver When Possible

```typescript
// ❌ Bad: Animated without native driver
Animated.timing(animatedValue, {
  toValue: 100,
  duration: 300,
  useNativeDriver: false, // Runs on JS thread
}).start();

// ✅ Good: With native driver
Animated.timing(animatedValue, {
  toValue: 100,
  duration: 300,
  useNativeDriver: true, // Runs on UI thread
}).start();
```

**Note**: Native driver only supports animating `transform` and `opacity`.

#### 2. Memoize Expensive Calculations

```typescript
// ❌ Bad: Recalculates on every render
function AnimatedComponent() {
  const animatedStyle = useAnimatedStyle(() => {
    const complexCalculation = performExpensiveOperation();
    return { transform: [{ scale: complexCalculation }] };
  });
}

// ✅ Good: Memoized calculation
function AnimatedComponent() {
  const calculatedValue = useMemo(() => performExpensiveOperation(), [deps]);
  
  const animatedStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: calculatedValue }] };
  });
}
```

#### 3. Avoid Animating Layout Properties

```typescript
// ❌ Bad: Animates layout (triggers expensive layout calculations)
const badStyle = useAnimatedStyle(() => ({
  width: width.value,
  height: height.value,
}));

// ✅ Good: Use transform instead
const goodStyle = useAnimatedStyle(() => ({
  transform: [
    { scaleX: scaleX.value },
    { scaleY: scaleY.value },
  ],
}));
```

#### 4. Batch State Updates

```typescript
// ❌ Bad: Multiple state updates
const handlePress = () => {
  setScale(1.2);
  setOpacity(0.8);
  setRotation(45);
};

// ✅ Good: Single state update
const handlePress = () => {
  setState({ scale: 1.2, opacity: 0.8, rotation: 45 });
};
```

#### 5. Use shouldComponentUpdate or React.memo

```typescript
// Prevent unnecessary re-renders
const AnimatedItem = React.memo(({ item }) => {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <ItemContent item={item} />
    </MotiView>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id;
});
```

### Avoiding Re-renders

#### Use Shared Values Instead of State

```typescript
// ❌ Bad: Uses state (triggers re-renders)
function BadComponent() {
  const [scale, setScale] = useState(1);
  
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* Re-renders on every scale change */}
    </Animated.View>
  );
}

// ✅ Good: Uses shared value (no re-renders)
function GoodComponent() {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <Animated.View style={animatedStyle}>
      {/* No re-renders on scale change */}
    </Animated.View>
  );
}
```

#### Separate Animated and Static Content

```typescript
// ❌ Bad: Everything re-renders
function BadComponent() {
  const opacity = useSharedValue(0);
  
  return (
    <Animated.View style={{ opacity: opacity.value }}>
      <ExpensiveComponent />
      <AnotherExpensiveComponent />
    </Animated.View>
  );
}

// ✅ Good: Only animated wrapper re-renders
function GoodComponent() {
  return (
    <AnimatedWrapper>
      <ExpensiveComponent />
      <AnotherExpensiveComponent />
    </AnimatedWrapper>
  );
}

const AnimatedWrapper = memo(({ children }) => {
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
});
```

### Performance Checklist

- [ ] Animations run at 60 FPS (no dropped frames)
- [ ] Native driver enabled for transform/opacity animations
- [ ] No unnecessary re-renders during animations
- [ ] Expensive calculations are memoized
- [ ] Gestures feel responsive (no lag)
- [ ] Animations don't block user interaction
- [ ] Reduced motion preference is respected
- [ ] No memory leaks from animation cleanup
- [ ] Bundle size impact is acceptable
- [ ] Tested on low-end devices

---

## Implementation Checklist

### Before Starting

- [ ] Determine which library is most appropriate (see Decision Matrix)
- [ ] Check if similar animation already exists (see Common Patterns)
- [ ] Consider performance impact (simple transforms preferred)
- [ ] Plan for reduced motion accessibility
- [ ] Define animation duration and easing

### During Implementation

- [ ] Use appropriate animation library
- [ ] Enable native driver when possible
- [ ] Implement reduced motion fallback
- [ ] Avoid animating layout properties
- [ ] Memoize expensive calculations
- [ ] Test on physical device (simulator can be misleading)
- [ ] Check for 60 FPS in performance monitor
- [ ] Ensure animations don't block interaction

### Testing

- [ ] Test on multiple device sizes
- [ ] Test on low-end device (if available)
- [ ] Test with slow animations (dev tools)
- [ ] Test with reduced motion enabled
- [ ] Test rapid user interactions
- [ ] Test memory usage (no leaks)
- [ ] Verify animation completes correctly
- [ ] Check for visual glitches or janks

### Code Review

- [ ] Animation purpose is clear
- [ ] Duration and easing are appropriate
- [ ] Code is maintainable and readable
- [ ] Performance impact is acceptable
- [ ] Accessibility is handled
- [ ] Cleanup is implemented
- [ ] Comments explain complex logic

---

## Quick Reference

### Installation Commands

```bash
# React Native Reanimated (likely already installed)
npm install react-native-reanimated

# Moti
npm install moti

# React-Spring
npm install @react-spring/native

# React Marquee (choose one)
npm install react-native-marquee
# or
npm install react-native-text-ticker

# React-Native-Skia
npm install @shopify/react-native-skia
```

### Import Patterns

```typescript
// Reanimated
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Moti
import { MotiView, MotiText, AnimatePresence } from 'moti';

// React-Spring
import { useSpring, animated } from '@react-spring/native';

// Skia
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
```

### Common Animation Values

```typescript
// Duration (ms)
INSTANT: 0
FAST: 150
NORMAL: 250
SLOW: 350

// Spring configs
DEFAULT_SPRING: { damping: 15, stiffness: 150 }
BOUNCY_SPRING: { damping: 10, stiffness: 100 }
SMOOTH_SPRING: { damping: 20, stiffness: 200 }
```

---

## Resources

### Official Documentation

- **Reanimated**: https://docs.swmansion.com/react-native-reanimated/
- **Moti**: https://moti.fyi/
- **React-Spring**: https://react-spring.dev/
- **React-Native-Skia**: https://shopify.github.io/react-native-skia/

### Community Resources

- William Candillon's "Can it be done in React Native?": https://www.youtube.com/wcandillon
- Reanimated Examples: https://github.com/software-mansion/react-native-reanimated/tree/main/app/src/examples
- Moti Examples: https://github.com/nandorojo/moti/tree/master/examples

### Performance Tools

- React Native Performance Monitor (built-in)
- Flipper (debugging and profiling)
- React DevTools Profiler
- Xcode Instruments (iOS)
- Android Studio Profiler (Android)

---

## Conclusion

This guide provides a comprehensive reference for implementing smooth animations across the Wagerproof mobile app. Remember:

1. **Start simple**: Use Moti for basic animations
2. **Graduate to advanced**: Use Reanimated for complex interactions
3. **Optimize early**: Performance is critical for good UX
4. **Test on devices**: Simulators don't show real performance
5. **Consider accessibility**: Always respect reduced motion preferences

By following these guidelines and patterns, you'll create a polished, performant mobile experience that delights users.

---

**Last Updated**: October 2025
**Maintained by**: Wagerproof Development Team

