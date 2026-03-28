import { useEffect, useState } from "react";
import { useRestaurant } from "../context/RestaurantContext";

export function useCardNames() {
  const { restaurantId } = useRestaurant();
  const [card1Name, setCard1Name] = useState(
    () => localStorage.getItem(`${restaurantId}_card1_name`) || "HDFC Card",
  );
  const [card2Name, setCard2Name] = useState(
    () => localStorage.getItem(`${restaurantId}_card2_name`) || "SBI Card",
  );
  useEffect(() => {
    const handler = () => {
      setCard1Name(
        localStorage.getItem(`${restaurantId}_card1_name`) || "HDFC Card",
      );
      setCard2Name(
        localStorage.getItem(`${restaurantId}_card2_name`) || "SBI Card",
      );
    };
    window.addEventListener("storage", handler);
    window.addEventListener("cardNamesUpdated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("cardNamesUpdated", handler);
    };
  }, [restaurantId]);
  return { card1Name, card2Name };
}
