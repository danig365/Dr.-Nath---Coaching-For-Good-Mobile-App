import { useState } from "react";
import { View, Text } from "react-native";
import { CardField, useStripe } from "@stripe/stripe-react-native";

import { api } from "@/api/client";
import { Button } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Mobile port of frontend/src/components/PaymentForm.jsx.
//
// Same contract — clientSecret in, confirm-on-success out — but the card entry
// is Stripe's native <CardField> instead of the web <CardElement>, and
// confirmation goes through the RN SDK's confirmPayment().
//
// The backend flow is unchanged: confirm with Stripe, then POST the resulting
// PaymentIntent id to the app's confirm endpoint so the booking is created.
export default function PaymentForm({
  clientSecret,
  amount,
  bookingData,
  onSuccess,
  confirmUrl = "/bookings/confirm-payment/",
  buildConfirmPayload,
}) {
  const { confirmPayment } = useStripe();
  const [cardComplete, setCardComplete] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!cardComplete) {
      toast.error("Please enter your full card details.");
      return;
    }
    setProcessing(true);

    const { error, paymentIntent } = await confirmPayment(clientSecret, {
      paymentMethodType: "Card",
    });

    if (error) {
      toast.error(error.message);
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === "Succeeded") {
      try {
        const payload = buildConfirmPayload
          ? buildConfirmPayload(paymentIntent.id)
          : { payment_intent_id: paymentIntent.id, booking_data: bookingData };
        await api.post(confirmUrl, payload);
        toast.success("Payment successful! Your session is confirmed.");
        onSuccess();
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          "Payment succeeded but booking failed. Contact support.";
        toast.error(msg);
      }
    }
    setProcessing(false);
  };

  return (
    <View className="gap-4">
      <View className="rounded-xl border border-gold/30 bg-white p-2">
        <CardField
          postalCodeEnabled={false}
          placeholders={{ number: "4242 4242 4242 4242" }}
          cardStyle={{
            backgroundColor: "#FFFFFF",
            textColor: colors.navy,
            placeholderColor: colors.slateLight,
            borderRadius: 8,
          }}
          style={{ width: "100%", height: 50 }}
          onCardChange={(details) => setCardComplete(details.complete)}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-sm text-slate">Total</Text>
        <Text className="font-display text-base text-gold-deep">
          ${amount?.toFixed(2)}
        </Text>
      </View>

      <Button
        variant="gold"
        onPress={handlePay}
        loading={processing}
        disabled={!cardComplete}
        fullWidth
      >
        {`Pay $${amount?.toFixed(2)}`}
      </Button>
    </View>
  );
}
