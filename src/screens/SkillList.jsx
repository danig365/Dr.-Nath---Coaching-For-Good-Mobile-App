import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { api } from "@/api/client";
import { Screen, Card, Button, Input } from "@/components/ui";
import { toast } from "@/lib/toast";
import { colors } from "@/theme/colors";

// Port of frontend/src/pages/SkillList.jsx — the public offerings directory.

const SKILLS_PER_PAGE = 8;

function SkillCard({ skill, onBook }) {
  return (
    <Card className="overflow-hidden p-0">
      <View className="h-1.5 bg-gold" />

      <View className="flex-1 p-6">
        <View className="mb-3 flex-row items-start justify-between gap-2">
          <Text className="flex-1 font-display text-lg leading-tight text-navy">
            {skill.title}
          </Text>
          <View className="rounded-full bg-gold/15 px-2.5 py-1">
            <Text className="font-sans-bold text-xs text-gold-deep">
              ${parseFloat(skill.price).toFixed(0)}/hr
            </Text>
          </View>
        </View>

        <Text className="mb-4 font-sans text-sm leading-6 text-slate" numberOfLines={3}>
          {skill.description}
        </Text>

        <View className="gap-3 border-t border-gold/15 pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-gold">
                <Text className="font-sans-bold text-xs text-navy-deep">
                  {skill.mentor?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="font-sans-medium text-xs text-gold">{skill.mentor}</Text>
            </View>

            {skill.rating !== null ? (
              <View className="flex-row items-center gap-1">
                <Feather name="star" size={12} color={colors.goldDeep} />
                <Text className="font-sans-semibold text-xs text-gold-deep">
                  {parseFloat(skill.rating).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          {onBook ? (
            <Button variant="gold" onPress={() => onBook(skill.id)} fullWidth>
              Book Session →
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function SkillList() {
  const router = useRouter();

  const [allSkills, setAllSkills] = useState([]);
  const [skillsToDisplay, setSkillsToDisplay] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(["All"]);

  useEffect(() => {
    if (allSkills.length > 0) {
      const unique = [...new Set(allSkills.map((s) => s.category))];
      setCategories(["All", ...unique.filter(Boolean)]);
    }
  }, [allSkills]);

  const fetchAllSkills = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/skills/public/");
      setAllSkills(res.data);
    } catch {
      toast.error("Failed to load skills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllSkills();
  }, [fetchAllSkills]);

  useEffect(() => {
    let filtered = allSkills;
    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.mentor?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedCategory !== "All") {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }
    setSkillsToDisplay(filtered);
    setCurrentPage(1);
  }, [allSkills, searchQuery, selectedCategory]);

  const indexOfLast = currentPage * SKILLS_PER_PAGE;
  const indexOfFirst = indexOfLast - SKILLS_PER_PAGE;
  const currentSkills = skillsToDisplay.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(skillsToDisplay.length / SKILLS_PER_PAGE);

  const handleBookSession = (skillId) => router.push(`/book/${skillId}`);

  const topRated = [...allSkills]
    .filter((s) => s.rating !== null)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setCurrentPage(1);
  };

  if (loading) return <Screen loading />;

  return (
    <Screen onRefresh={fetchAllSkills} refreshing={false}>
      <Text className="mb-2 font-display text-3xl text-navy">
        Browse <Text className="text-gold-deep">Sessions</Text>
      </Text>
      <Text className="mb-8 font-sans text-base text-slate">
        Find a programme that fits what you're working on.
      </Text>

      <Input
        placeholder="Search by title or coach…"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
      />

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pb-1"
        className="mb-6"
      >
        {categories.map((c) => {
          const active = selectedCategory === c;
          return (
            <Pressable
              key={c}
              onPress={() => setSelectedCategory(c)}
              className={`rounded-full px-4 py-2 ${
                active ? "bg-gold" : "border border-gold/25 bg-white"
              }`}
            >
              <Text
                className={`font-sans-semibold text-sm ${
                  active ? "text-navy-deep" : "text-slate"
                }`}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Top rated */}
      {topRated.length > 0 && !searchQuery && selectedCategory === "All" ? (
        <View className="mb-8">
          <View className="mb-3 flex-row items-center gap-2">
            <Feather name="star" size={14} color={colors.gold} />
            <Text className="text-xs font-sans-semibold uppercase tracking-wider text-gold-deep">
              Top rated
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 pb-1"
          >
            {topRated.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => handleBookSession(s.id)}
                className="w-56 rounded-2xl border border-gold/15 bg-white p-4"
              >
                <Text className="font-display text-base text-navy" numberOfLines={2}>
                  {s.title}
                </Text>
                <Text className="mt-1 font-sans text-xs text-slate">{s.mentor}</Text>
                <View className="mt-2 flex-row items-center gap-1">
                  <Feather name="star" size={11} color={colors.goldDeep} />
                  <Text className="font-sans-semibold text-xs text-gold-deep">
                    {parseFloat(s.rating).toFixed(1)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Results */}
      {skillsToDisplay.length === 0 ? (
        <Card className="items-center py-20">
          <Text className="mb-4 text-5xl">🔍</Text>
          <Text className="mb-2 font-display text-xl text-navy">No sessions found</Text>
          <Text className="mb-5 text-center font-sans text-sm text-slate">
            Try a different search or category.
          </Text>
          <Button variant="gold" onPress={resetFilters}>
            Clear filters
          </Button>
        </Card>
      ) : (
        <View className="gap-5">
          {currentSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} onBook={handleBookSession} />
          ))}
        </View>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <View className="mt-6 flex-row items-center justify-center gap-3">
          <Pressable
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`h-9 w-9 items-center justify-center rounded-full border border-gold/25 bg-white ${
              currentPage === 1 ? "opacity-40" : ""
            }`}
          >
            <Feather name="chevron-left" size={16} color={colors.navy} />
          </Pressable>
          <Text className="font-sans text-sm text-slate">
            Page {currentPage} of {totalPages}
          </Text>
          <Pressable
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`h-9 w-9 items-center justify-center rounded-full border border-gold/25 bg-white ${
              currentPage === totalPages ? "opacity-40" : ""
            }`}
          >
            <Feather name="chevron-right" size={16} color={colors.navy} />
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
