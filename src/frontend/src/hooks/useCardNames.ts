import { useRestaurant } from "../context/RestaurantContext";

export function useCardNames() {
  const { restaurantId } = useRestaurant();
  const card1Name =
    localStorage.getItem(`${restaurantId}_card1_name`) || "HDFC Card";
  const card2Name =
    localStorage.getItem(`${restaurantId}_card2_name`) || "SBI Card";
  return { card1Name, card2Name };
}
