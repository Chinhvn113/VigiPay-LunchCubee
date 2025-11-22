import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCreateBankAccount } from "@/hooks/useBankAccount";
import { Loader2 } from "lucide-react";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddAccountDialog = ({ open, onOpenChange }: AddAccountDialogProps) => {
  const [accountType, setAccountType] = useState<'main' | 'savings' | 'investment'>('savings');
  const { t } = useLanguage();
  const createAccount = useCreateBankAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createAccount.mutate(
      { account_type: accountType },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAccountType('savings'); // Reset form
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card border-border/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            {t('addAccount')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t('selectAccountType') || 'Select the type of account you want to create'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="accountType" className="text-foreground">
              {t('accountType') || 'Account Type'}
            </Label>
            <Select 
              value={accountType} 
              onValueChange={(value) => setAccountType(value as typeof accountType)}
            >
              <SelectTrigger 
                id="accountType" 
                className="bg-background/50 border-border/30 transition-all duration-300 focus:ring-2 focus:ring-primary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">{t('mainAccount') || 'Main Account'}</SelectItem>
                <SelectItem value="savings">{t('savingsAccount') || 'Savings Account'}</SelectItem>
                <SelectItem value="investment">{t('investmentAccount') || 'Investment Account'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-border/30 transition-all duration-300 hover:scale-[1.02]"
              disabled={createAccount.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-accent-green transition-all duration-300 hover:scale-[1.02]"
              disabled={createAccount.isPending}
            >
              {createAccount.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creating') || 'Creating...'}
                </>
              ) : (
                t('addAccount')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
