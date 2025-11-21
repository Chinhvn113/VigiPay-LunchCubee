// src/components/FinanceQuoteWidget.tsx

import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Quote } from "lucide-react";

const quotes = [
  {
    quote: "Beware of little expenses. A small leak will sink a great ship.",
    author: "Benjamin Franklin"
  },
  {
    quote: "The stock market is a device for transferring money from the impatient to the patient.",
    author: "Warren Buffett"
  },
  {
    quote: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin"
  },
  {
    quote: "A penny saved is a penny earned.",
    author: "Benjamin Franklin"
  },
    {
        quote: "The individual investor should act consistently as an investor and not as a speculator.",
        author: "Ben Graham"
    },
    {
        quote: "Never spend your money before you have it.",
        author: "Thomas Jefferson"
    }
];

export const FinanceQuoteWidget = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    }, 5000); // Switch every 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const activeQuote = quotes[currentIndex];

  return (
    <Card>
      <CardContent className="p-6">
        <div 
          key={currentIndex} 
          className="flex flex-col items-center text-center animate-fade-in"
        >
          <Quote className="h-8 w-8 text-muted-foreground/50 mb-4" />
          <p className="text-lg italic font-medium">
            "{activeQuote.quote}"
          </p>
          <p className="text-sm text-muted-foreground mt-3 font-semibold">
            — {activeQuote.author}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};