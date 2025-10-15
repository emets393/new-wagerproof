import React, { useState, useEffect } from "react";
import { Plus, ShoppingCart, Users, Clock, Calendar, Search, ChefHat, Bot, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import Counter from "@/animata/text/counter";
import Ticker from "@/animata/text/ticker";
import TypingText from "@/animata/text/typing-text";
import { AnimatedList } from "@/components/magicui/animated-list";
import CurvedLoop from "@/components/magicui/curved-loop";

// Meal planning data
const mealPlanData = [
  { day: "Mon", meal: "Angus Burger", time: "50m" },
  { day: "Tue", meal: "Tikka Masala", time: "2hr" },
  { day: "Wed", meal: "Tacos", time: "25m" },
  { day: "Thu", meal: "Glow Bowl", time: "10m" },
  { day: "Fri", meal: "Mediterranean", time: "45m" },
];

// Grocery items sample
const groceryItems = [
  { name: "Chicken breasts", amount: "2 lb", checked: false },
  { name: "Basil", amount: "1 tsp", checked: true },
  { name: "Breadcrumbs", amount: "1/2 cup", checked: false },
];

function BentoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl p-4", className)}>
      {children}
    </div>
  );
}

// App rating tile
function RatingTile() {
  return (
    <BentoCard className="flex flex-col bg-honeydew-100 dark:bg-honeydew-900/20">
      <div className="font-bold text-honeydew-700 dark:text-honeydew-400">Highly rated</div>
      <div className="mt-auto flex justify-end items-baseline">
        <div className="text-4xl font-black text-honeydew-800/80 dark:text-honeydew-300 md:text-6xl">
          <Ticker value="4.8" />
        </div>
        <sup className="text-xl text-honeydew-600 dark:text-honeydew-400 ml-1">★</sup>
      </div>
    </BentoCard>
  );
}

// Recipes saved tile
function RecipesSavedTile() {
  const savedRecipes = [
    { name: "Spicy Thai Noodles", user: "@sarah_k" },
    { name: "Grandma's Apple Pie", user: "@mike_chef" },
    { name: "Vegan Buddha Bowl", user: "@healthy_eats" },
    { name: "Korean BBQ Tacos", user: "@fusion_fan" },
    { name: "Classic Tiramisu", user: "@italian_love" },
    { name: "Honey Garlic Salmon", user: "@quick_meals" },
    { name: "Mushroom Risotto", user: "@comfort_food" },
    { name: "Green Smoothie Bowl", user: "@morning_fuel" },
  ];

  return (
    <BentoCard className="relative flex flex-col bg-gradient-to-br from-honeydew-400 to-honeydew-500 dark:from-honeydew-600/30 dark:to-honeydew-700/30 sm:col-span-2">
      <div className="mb-1">
        <strong className="text-lg font-semibold text-white dark:text-honeydew-100">
          <Counter targetValue={270} format={(v) => +Math.ceil(v) + ",000 recipes saved"} />
        </strong>
        <div className="text-xs text-white/80 dark:text-honeydew-200/70">each month</div>
      </div>
      
      <div className="relative flex-1 min-h-[108px]">
        <AnimatedList delay={2500} itemsToShow={3}>
          {savedRecipes.map((recipe, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-white/20 dark:bg-honeydew-900/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-white dark:text-honeydew-100"
            >
              <Bookmark className="size-3.5 text-white/90 dark:text-honeydew-200/90 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{recipe.name}</p>
                <p className="text-[10px] text-white/70 dark:text-honeydew-300/60">{recipe.user} just saved</p>
              </div>
            </div>
          ))}
        </AnimatedList>
      </div>
    </BentoCard>
  );
}

// Recipe capture tile with custom text scroller
function RecipeCaptureTile() {
  const platformText = "TikTok ✦ Instagram ✦ YouTube ✦ Pinterest ✦ Facebook ✦ Photo ✦ Reddit ✦ Web ✦ ";
  const repeatedText = platformText + platformText + platformText; // Repeat for continuous scroll

  return (
    <BentoCard className="relative flex flex-col bg-pink-100 dark:bg-pink-900/20 overflow-hidden p-3">
      <ChefHat className="size-6 md:size-7 text-pink-600 dark:text-pink-400 relative z-10" />
      <strong className="mt-0.5 inline-block text-xs font-semibold text-pink-700 dark:text-pink-300 relative z-10">Recipe Capture From Anywhere</strong>
      
      {/* Custom curved text scroller for bento card */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none">
        <svg
          className="w-full h-full"
          viewBox="0 0 400 120"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <path
              id="bento-curve-path"
              d="M -50,60 Q 200,40 450,60"
              fill="none"
            />
          </defs>
          <text
            className="fill-pink-600/40 dark:fill-pink-300/40 text-lg font-bold uppercase"
            style={{ fontSize: '24px' }}
          >
            <textPath href="#bento-curve-path">
              <animate
                attributeName="startOffset"
                from="0%"
                to="-100%"
                dur="20s"
                repeatCount="indefinite"
              />
              {repeatedText}
            </textPath>
          </text>
        </svg>
      </div>
    </BentoCard>
  );
}

// Generate grocery list tile
function GroceryListTile() {
  return (
    <BentoCard className="flex flex-col gap-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 sm:col-span-2">
      <div className="flex items-center justify-between">
        <div className="text-xl font-black text-blue-800 dark:text-blue-300">Generate grocery list</div>
        <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
      </div>
      
      <div className="space-y-2">
        {groceryItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg px-3 py-2">
            <Checkbox checked={item.checked} className="border-blue-500" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              <span className="text-blue-600 dark:text-blue-400">{item.amount}</span> {item.name}
            </span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-between mt-auto">
        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">35 Items</span>
        <button className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors">
          Auto Sort
        </button>
      </div>
    </BentoCard>
  );
}

// Meal Planner tile
function MealPlannerTile() {
  return (
    <BentoCard className="flex flex-col bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-purple-800 dark:text-purple-300">Weekly Meal Plan</h3>
        <Calendar className="size-6 text-purple-600 dark:text-purple-400" />
      </div>
      
      <div className="grid grid-cols-5 gap-1.5 my-3">
        {mealPlanData.map((meal, idx) => (
          <div key={idx} className="flex flex-col bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg p-2 min-h-[80px]">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{meal.day}</span>
            <span className="text-xs text-purple-900 dark:text-purple-100 truncate mt-1 flex-1">{meal.meal}</span>
            <div className="mt-2 space-y-1">
              <div className="bg-purple-400/30 dark:bg-purple-500/30 rounded-full px-2 py-0.5">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium flex items-center gap-0.5 justify-center">
                  <Clock className="size-2.5" />
                  {meal.time}
                </span>
              </div>
              <div className="bg-purple-300/40 dark:bg-purple-400/40 rounded-full px-2 py-0.5">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium text-center block">
                  Ready
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-auto">
        <button className="flex items-center gap-2 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-full text-sm font-medium transition-colors">
          <Plus size={16} />
          Quick Add
        </button>
      </div>
    </BentoCard>
  );
}

// AI Integrated tile
function AIIntegratedTile() {
  const qaPairs = [
    {
      question: "Can you meal plan my week?",
      answer: "Sure, I just planned 4 recipes for you!"
    },
    {
      question: "What's in my grocery list?",
      answer: "35 items ready - chicken, basil, breadcrumbs..."
    },
    {
      question: "Find quick dinner recipes",
      answer: "Found 12 recipes under 30 minutes!"
    }
  ];

  const [currentQA, setCurrentQA] = useState(0);
  const [key, setKey] = useState(0); // Force re-render of TypingText

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentQA((prev) => (prev + 1) % qaPairs.length);
      setKey(prev => prev + 1); // Force TypingText to restart
    }, 7000); // 7 seconds total per Q&A

    return () => clearTimeout(timer);
  }, [currentQA, qaPairs.length]);

  return (
    <BentoCard className="flex flex-col bg-orange-300 dark:bg-orange-900/30">
      <Bot className="size-8 md:size-12 text-orange-700 dark:text-orange-400" />
      <strong className="mt-1 inline-block text-sm">Integrated AI</strong>

      <div className="mt-auto">
        <div className="text-sm font-medium">{qaPairs[currentQA].question}</div>
        <div className="font-semibold">
          <TypingText
            key={key} // Force component to remount and restart animation
            text={qaPairs[currentQA].answer}
            waitTime={1000}
            alwaysVisibleCount={0}
          />
        </div>
      </div>
    </BentoCard>
  );
}

// Recipe tags tile
function RecipeTagsTile() {
  return (
    <BentoCard className="flex flex-col gap-2 bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30">
      <div className="space-y-2">
        <div className="w-full -rotate-1 rounded-full bg-rose-400 dark:bg-rose-600 py-2 text-center font-semibold text-white text-sm">
          Quick & Easy
        </div>
        <div className="w-full rotate-1 rounded-full bg-rose-400 dark:bg-rose-600 py-2 text-center font-semibold text-white text-sm">
          Vegetarian
        </div>
        <div className="w-full rounded-full bg-rose-400 dark:bg-rose-600 py-2 text-center font-semibold text-white text-sm">
          Family Favorite
        </div>
      </div>
      <div className="text-xs text-center text-rose-700 dark:text-rose-300 font-medium mt-auto">
        Smart categorization
      </div>
    </BentoCard>
  );
}

// Recipe Library tile
function RecipeLibraryTile() {
  const nutritionData = [
    { label: "Calories", value: 90, unit: "", color: "bg-gray-700 dark:bg-gray-600" },
    { label: "Protein", value: 25, unit: "g", color: "bg-orange-500 dark:bg-orange-600" },
    { label: "Fat", value: 16, unit: "g", color: "bg-yellow-500 dark:bg-yellow-600" },
    { label: "Carbs", value: 50, unit: "g", color: "bg-green-500 dark:bg-green-600" },
    { label: "Fiber", value: 3, unit: "g", color: "bg-red-500 dark:bg-red-600" },
  ];

  // Calculate total and proportional flex values
  const total = nutritionData.reduce((sum, item) => sum + item.value, 0);
  const minFlex = 0.7; // Minimum flex value to ensure all cards are visible
  const maxFlex = 1.3; // Maximum flex value to prevent extreme differences
  
  const nutritionDataWithFlex = nutritionData.map(item => ({
    ...item,
    // Calculate flex value: base of 1 with slight influence from the proportion
    flex: Math.max(minFlex, Math.min(maxFlex, 0.8 + (item.value / total) * 1.2))
  }));

  return (
    <BentoCard className="relative flex flex-col bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 sm:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-black text-amber-800 dark:text-amber-300">Nutrition Tracking</div>
          <p className="text-xs text-amber-700 dark:text-amber-400">Daily nutritional intake</p>
        </div>
        <ChefHat className="size-4 text-amber-600 dark:text-amber-400" />
      </div>
      
      <div className="flex items-stretch justify-between gap-1.5 h-20">
        {nutritionDataWithFlex.map((item, idx) => (
          <div 
            key={idx} 
            className={`flex flex-col items-center justify-center ${item.color} rounded-xl p-2`}
            style={{ flex: item.flex }}
          >
            <div className="text-xl font-bold text-white dark:text-black">
              {item.value}
              <span className="text-xs font-normal">{item.unit}</span>
            </div>
            <div className="text-xs text-white/90 dark:text-black/80 font-medium">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}

export default function HoneydewBentoGrid() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <RatingTile />
        <RecipesSavedTile />
        <RecipeCaptureTile />
        <GroceryListTile />
        <MealPlannerTile />
        <AIIntegratedTile />
        <RecipeTagsTile />
        <RecipeLibraryTile />
      </div>
    </div>
  );
}