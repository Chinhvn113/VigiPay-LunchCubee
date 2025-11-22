import { Eye, EyeOff, History, CreditCard as CreditCardIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddAccountDialog } from "./AddAccountDialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBankAccounts } from "@/hooks/useBankAccount";
import { formatCurrency } from "@/apis/bankService";

export const AccountCard = () => {
  const [showBalance, setShowBalance] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Fetch real bank accounts
  const { data: accounts, isLoading, error } = useBankAccounts();

  const currentAccount = accounts?.[currentAccountIndex];
  
  // Helper function to get account type display name
  const getAccountTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      'main': t('mainAccount') || 'Main Account',
      'savings': t('savingsAccount') || 'Savings Account',
      'investment': t('investmentAccount') || 'Investment Account',
    };
    return typeMap[type] || type;
  };

  const handlePreviousAccount = () => {
    if (isTransitioning || !accounts) return;
    setDirection('left'); // Going to previous = swipe right
    setIsTransitioning(true);
    setTransitionPhase('exit');
    
    // Phase 1: Exit animation (current card slides out to right)
    setTimeout(() => {
      setCurrentAccountIndex((prevIndex) => (prevIndex === 0 ? accounts.length - 1 : prevIndex - 1));
      setTransitionPhase('enter');
    }, 150);
    
    // Phase 2: Enter animation (new card slides in from left)
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionPhase('idle');
    }, 300);
  };

  const handleNextAccount = () => {
    if (isTransitioning || !accounts) return;
    setDirection('right'); // Going to next = swipe left
    setIsTransitioning(true);
    setTransitionPhase('exit');
    
    // Phase 1: Exit animation (current card slides out to left)
    setTimeout(() => {
      setCurrentAccountIndex((prevIndex) => (prevIndex === accounts.length - 1 ? 0 : prevIndex + 1));
      setTransitionPhase('enter');
    }, 150);
    
    // Phase 2: Enter animation (new card slides in from right)
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionPhase('idle');
    }, 300);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-accent-green" />
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-center py-8 text-red-500">
          {t('errorLoadingAccounts') || 'Error loading accounts'}
        </div>
      </div>
    );
  }
  
  // No accounts state
  if (!accounts || accounts.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-6">
        {/* CHANGED: Updated title to 'Your Account' */}
        <h3 className="text-xl font-semibold text-foreground">{t('yourAccount') || 'Your Account'}</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{t('noAccounts') || 'No accounts found'}</p>
          <Button onClick={() => setShowAddAccountDialog(true)}>
            {t('addAccount')}
          </Button>
        </div>
        <AddAccountDialog 
          open={showAddAccountDialog} 
          onOpenChange={setShowAddAccountDialog} 
        />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        {/* CHANGED: Updated title to 'Your Account' to be generic for all slides */}
        <h3 className="text-xl font-semibold text-foreground">{t('yourAccount') || 'Your Account'}</h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handlePreviousAccount}
            disabled={accounts.length <= 1 || isTransitioning}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleNextAccount}
            disabled={accounts.length <= 1 || isTransitioning}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Account Info */}
      <div 
        className={`glass-card rounded-xl p-6 space-y-4 border border-accent-green/30 transition-all duration-150 ease-out ${
          transitionPhase === 'exit'
            ? direction === 'right'
              ? 'opacity-0 -translate-x-8' // Exit left when going next
              : 'opacity-0 translate-x-8'   // Exit right when going previous
            : transitionPhase === 'enter'
            ? direction === 'right'
              ? 'opacity-0 translate-x-8'   // Enter from right when going next
              : 'opacity-0 -translate-x-8'  // Enter from left when going previous
            : 'opacity-100 translate-x-0'   // Idle state
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-accent-green text-sm font-medium">
            {getAccountTypeName(currentAccount.account_type)}
          </span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{t('accountNumber')}</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-mono">{currentAccount.account_number}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <CreditCardIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{t('currentBalance')}</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-mono">
                {showBalance ? formatCurrency(currentAccount.balance) : "*** VND"}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 transition-all duration-300 hover:scale-110"
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 border-border/50 hover:bg-accent/50 transition-all duration-300 hover:scale-[1.02]"
            onClick={() => navigate('/transaction-history')}
          >
            <History className="h-4 w-4" />
            {t('transactionHistory')}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 border-border/50 hover:bg-accent/50 transition-all duration-300 hover:scale-[1.02]"
            onClick={() => setShowAddAccountDialog(true)}
          >
            <CreditCardIcon className="h-4 w-4" />
            {t('addAccount')}
          </Button>
        </div>
      </div>
      
      {/* Pagination Dots - Show only if multiple accounts */}
      {accounts.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {accounts.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (index !== currentAccountIndex && !isTransitioning) {
                  setDirection(index > currentAccountIndex ? 'right' : 'left');
                  setIsTransitioning(true);
                  setTransitionPhase('exit');
                  
                  // Phase 1: Exit animation
                  setTimeout(() => {
                    setCurrentAccountIndex(index);
                    setTransitionPhase('enter');
                  }, 150);
                  
                  // Phase 2: Enter animation
                  setTimeout(() => {
                    setIsTransitioning(false);
                    setTransitionPhase('idle');
                  }, 300);
                }
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentAccountIndex 
                  ? 'w-8 bg-accent-green' 
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`Go to account ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      <AddAccountDialog 
        open={showAddAccountDialog} 
        onOpenChange={setShowAddAccountDialog} 
      />
    </div>
  );
};