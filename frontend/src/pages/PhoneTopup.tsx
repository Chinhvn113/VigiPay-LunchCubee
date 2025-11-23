import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

const PhoneTopup = () => {
  const location = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const prefillData = location.state?.prefill;
    if (prefillData) {
      if (prefillData.phone_number) {
        setPhoneNumber(prefillData.phone_number);
      }
      
      if (prefillData.amount) {
        const numericAmount = Number(prefillData.amount);
        if (amounts.includes(numericAmount)) {
          setSelectedAmount(numericAmount);
        }
      }

      toast({
        title: t('notification'),
        description: t('autofillFromVoiceCommand'),
      });
    }
  }, [location.state]);

  const amounts = [10000, 20000, 50000, 100000, 200000, 500000];

  const handleTopup = () => {
    if (!phoneNumber || !selectedAmount) {
      toast({
        title: t('error'),
        description: t('fieldRequired'),
        variant: "destructive"
      });
      return;
    }

    toast({
      title: t('success'),
      description: `${t('topupPhone')}: ${selectedAmount.toLocaleString('vi-VN')}đ - ${phoneNumber}`,
    });

    setPhoneNumber("");
    setSelectedAmount(null);
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('phoneTopup')}</h1>
          </div>
          <p className="text-muted-foreground">
            {t('topupPhone')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('transaction')}</CardTitle>
            <CardDescription>
              {t('selectAmount')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('enterPhoneNumber')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('enterPhoneNumber')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>{t('selectAmount')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {amounts.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => setSelectedAmount(amount)}
                    className="h-auto py-4"
                  >
                    <div className="text-center">
                      <div className="font-bold">{amount.toLocaleString('vi-VN')}đ</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleTopup}
              className="w-full"
              size="lg"
            >
              {t('topupPhone')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PhoneTopup;
