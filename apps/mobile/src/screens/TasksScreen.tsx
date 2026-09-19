import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchTasks, createTask, updateTaskStatus } from "../services/api";
import { SeoTaskItem, TaskStatus, TaskPriority } from "../types";

export const TasksScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [tasks, setTasks] = useState<SeoTaskItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [loading, setLoading] = useState(false);

  // Add Task Modal
  const [addModal, setAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("HIGH");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (selectedSite) {
      setLoading(true);
      fetchTasks(selectedSite.id).then(setTasks).finally(() => setLoading(false));
    }
  }, [selectedSite?.id]);

  const handleCycleStatus = async (task: SeoTaskItem) => {
    const cycle: Record<TaskStatus, TaskStatus> = {
      TODO: "IN_PROGRESS",
      IN_PROGRESS: "REVIEW",
      REVIEW: "COMPLETED",
      COMPLETED: "TODO"
    };
    const nextStatus = cycle[task.status];
    await updateTaskStatus(task.id, nextStatus);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !selectedSite) return;
    setIsCreating(true);
    try {
      const created = await createTask(selectedSite.id, {
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        status: "TODO",
        estimated_impact: "HIGH",
        difficulty: "EASY"
      });
      setTasks(prev => [created, ...prev]);
      setNewTitle("");
      setNewDesc("");
      setAddModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === "ALL") return true;
    return t.status === statusFilter;
  });

  const getStatusLabel = (s: TaskStatus) => {
    switch (s) {
      case "TODO": return "Yapılacak";
      case "IN_PROGRESS": return "Sürüyor";
      case "REVIEW": return "İnceleme";
      case "COMPLETED": return "Tamamlandı";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("hub")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SEO Görev Yönetimi</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* AI Prioritization Summary Banner */}
      <GlassCard style={styles.prioritizationBanner}>
        <View style={styles.prioRow}>
          <Ionicons name="sparkles" size={16} color={Colors.accent} />
          <Text style={styles.prioTitle}>AI Önceliklendirme Matrisi</Text>
        </View>
        <Text style={styles.prioDesc}>
          En yüksek etki ve en düşük uygulama eforuna sahip görevler listenin en başında otomatik sıralanır.
        </Text>
      </GlassCard>

      {/* Status Filter Horizontal Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {(["ALL", "TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const).map((s) => {
          const isActive = statusFilter === s;
          const label = s === "ALL" ? "Tümü" : getStatusLabel(s);
          const count = s === "ALL" ? tasks.length : tasks.filter(t => t.status === s).length;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Task List */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 30 }} />
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkbox-outline" size={38} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Bu aşamada görev bulunmuyor.</Text>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            return (
              <GlassCard key={task.id} style={styles.taskCard}>
                <View style={styles.taskTop}>
                  <View style={styles.pillsRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: task.priority === "CRITICAL" ? Colors.dangerSurface : Colors.warningSurface }]}>
                      <Text style={[styles.priorityText, { color: task.priority === "CRITICAL" ? Colors.danger : Colors.warning }]}>
                        {task.priority === "CRITICAL" ? "Kritik Öncelik" : "Yüksek Öncelik"}
                      </Text>
                    </View>

                    <View style={styles.impactBadge}>
                      <Text style={styles.impactText}>Etkisi Yüksek / Kolay</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.statusBtn, isCompleted && styles.statusBtnDone]}
                    onPress={() => handleCycleStatus(task)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                      size={14}
                      color={isCompleted ? Colors.success : Colors.primary}
                    />
                    <Text style={[styles.statusBtnText, isCompleted && { color: Colors.success }]}>
                      {getStatusLabel(task.status)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>
                  {task.title}
                </Text>
                <Text style={styles.taskDesc}>{task.description}</Text>

                <View style={styles.taskFooter}>
                  <View style={styles.footerItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.footerText}>Bitiş: {task.due_date || "Bu Hafta"}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Ionicons name="link-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.footerText} numberOfLines={1}>{task.affected_url || "/"}</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni SEO Görevi Oluştur</Text>
            <Text style={styles.modalSub}>Siteniz için yapılacak optimizasyon adımını tanımlayın:</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Görev Başlığı (Örn: H1 etiketlerini düzelt)"
              placeholderTextColor={Colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]}
              placeholder="Açıklama veya talimatlar..."
              placeholderTextColor={Colors.textMuted}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, !newTitle.trim() && { opacity: 0.5 }]}
                disabled={!newTitle.trim() || isCreating}
                onPress={handleCreate}
              >
                <Text style={styles.modalSubmitText}>{isCreating ? "Kaydediliyor..." : "Görevi Ekle"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  prioritizationBanner: {
    margin: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    gap: 4,
  },
  prioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prioTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  prioDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  filterScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  taskCard: {
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  taskTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  impactBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  impactText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "600",
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBtnDone: {
    backgroundColor: Colors.successSurface,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: Colors.textMuted,
  },
  taskDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  taskFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
