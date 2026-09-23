import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "./src/theme/colors";
import { AppProvider, useApp } from "./src/context/AppContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { Header } from "./src/components/Header";
import { TabBar } from "./src/components/TabBar";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { QuickAuditScreen } from "./src/screens/QuickAuditScreen";
import { RecommendationsScreen } from "./src/screens/RecommendationsScreen";
import { KnowledgeScreen } from "./src/screens/KnowledgeScreen";
import { BillingScreen } from "./src/screens/BillingScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AiAssistantScreen } from "./src/screens/AiAssistantScreen";
import { GeoScreen } from "./src/screens/GeoScreen";
import { HubScreen } from "./src/screens/HubScreen";
import { KeywordsScreen } from "./src/screens/KeywordsScreen";
import { CompetitorsScreen } from "./src/screens/CompetitorsScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { ContentOptimizerScreen } from "./src/screens/ContentOptimizerScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { QuickActionFab } from "./src/components/QuickActionFab";
import { BiometricPromptModal } from "./src/components/BiometricPromptModal";

import { Ionicons } from "@expo/vector-icons";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("ErrorBoundary caught error:", error?.message, errorInfo?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorScreen}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconRing}>
              <Ionicons name="alert-circle" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.errorTitle}>Arayüz Yenileniyor</Text>
            <Text style={styles.errorDesc}>
              {this.state.error?.message || "Sayfa bileşenleri yüklenirken bir render sorunu algılandı."}
            </Text>
            <TouchableOpacity 
              style={styles.retryBtn}
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Görünümü Yenile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const MainNavigator: React.FC = () => {
  const { activeTab } = useApp();
  const { isAuthenticated } = useAuth();

  return (
    <View style={styles.webContainer}>
      <View style={styles.phoneFrame}>
        <ErrorBoundary>
          {!isAuthenticated ? (
            <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
              <StatusBar style="light" />
              <LoginScreen />
            </SafeAreaView>
          ) : (
            <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
              <StatusBar style="light" />
              <Header />
              <View style={styles.screenContainer}>
                {activeTab === "dashboard" && <DashboardScreen />}
                {activeTab === "quick_audit" && <QuickAuditScreen />}
                {activeTab === "ai" && <AiAssistantScreen />}
                {activeTab === "geo" && <GeoScreen />}
                {activeTab === "hub" && <HubScreen />}
                {activeTab === "keywords" && <KeywordsScreen />}
                {activeTab === "competitors" && <CompetitorsScreen />}
                {activeTab === "tasks" && <TasksScreen />}
                {activeTab === "content_optimizer" && <ContentOptimizerScreen />}
                {activeTab === "reports" && <ReportsScreen />}
                {activeTab === "settings" && <SettingsScreen />}
                {activeTab === "recommendations" && <RecommendationsScreen />}
                {activeTab === "knowledge" && <KnowledgeScreen />}
                {activeTab === "billing" && <BillingScreen />}
              </View>
              <QuickActionFab />
              <TabBar />
              <BiometricPromptModal />
            </SafeAreaView>
          )}
        </ErrorBoundary>
      </View>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <MainNavigator />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const isWeb = Platform.OS === "web";

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: isWeb ? "#040508" : Colors.background,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: isWeb ? ("100vh" as any) : "100%",
  },
  phoneFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 460,
    minHeight: isWeb ? ("100vh" as any) : "100%",
    backgroundColor: Colors.background,
    borderLeftWidth: isWeb ? 1 : 0,
    borderRightWidth: isWeb ? 1 : 0,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    position: "relative",
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    position: "relative",
  },
  screenContainer: {
    flex: 1,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
  },
  errorIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  errorDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
