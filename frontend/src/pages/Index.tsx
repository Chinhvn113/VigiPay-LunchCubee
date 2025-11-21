import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { FavoriteFunctions } from "@/components/FavoriteFunctions";
import { AccountCard } from "@/components/AccountCard";
import { FinanceQuoteWidget } from "@/components/FinanceQuoteWidget"; // <-- Import new component
import { SentinelFastChat } from "@/components/SentinelFastChat";   // <-- Import new component
import { WelcomeBanner } from "@/components/WelcomeBanner";

const Index = () => {
  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
        {/* Welcome Banner */}
        <WelcomeBanner />
        
        {/* Favorite Functions */}
        <FavoriteFunctions />
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-4 md:gap-6 animate-fade-in w-full">
          
          {/* Left Column (Sentinel AI Fast Chat) */}
          <div>
            <SentinelFastChat />
          </div>

          {/* Right Column (Account Card + Quotes) */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            <AccountCard />
            <FinanceQuoteWidget />
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;