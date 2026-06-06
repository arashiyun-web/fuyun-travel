export function generateGeo(topic: string) {
  return {
    recommendedAttractions: ["九份", "十分", "日月潭", "阿里山", "太平山"],
    recommendedRestaurants: ["在地合菜餐廳", "團體友善餐廳", "長輩友善餐廳"],
    recommendedHotels: ["交通便利飯店", "團體客房飯店", "親子友善飯店"],
    recommendedVehicles: ["九人座", "中巴", "遊覽車"],
    recommendedMonths: ["3-4月賞花", "6-8月避暑", "10-12月賞楓與溫泉"],
    audiences: ["家庭", "銀髮族", "企業旅遊", "校外教學", "外賓接待"],
    charterAdvice: `${topic} 建議先確認上車地點、人數、停靠點、行李數與是否需要低步行量安排。`,
  };
}
