/**
 * A photo or video full screen: previous / next within its note,
 * "Text in photo" (what the phone read in it: copy it or add it to the note)
 * and "Remove from note". Always dark, like a photo viewer.
 */
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageOff,
  ScanText,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { copy } from "@/copy";
import { sweepUnusedFiles } from "@/data/attachments";
import { useQuery, useRepo } from "@/data/DataProvider";
import { appFileStore } from "@/data/telegramRunner";
import { isVisual, type Attachment } from "@/data/types";
import { useTheme, withAlpha } from "@/theme/theme";
import { focusRing, AppText, type PState } from "@/ui/Text";
import { useFileUri } from "@/ui/media";
import { BottomSheet, Dialog } from "@/ui/overlays";
import { SheetRow } from "@/features/sheets";
import { useSnackbar } from "@/ui/snackbar";

function DarkButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof X;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={(s: PState) => [
        styles.btn,
        {
          backgroundColor: withAlpha(
            "#ffffff",
            s.pressed || s.hovered ? 0.22 : 0.12,
          ),
        },
        disabled && { opacity: 0.3 },
        focusRing(t, s, 24),
      ]}
    >
      <Icon size={24} color="#ffffff" />
    </Pressable>
  );
}

function VideoPane({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

function Media({ a }: { a: Attachment }) {
  const uri = useFileUri(a.fileName);
  if (uri === undefined) return null;
  if (uri === null) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { gap: 8, padding: 24 },
        ]}
      >
        <ImageOff size={40} color="#ffffffaa" />
        <AppText weight="600" style={{ color: "#ffffff" }}>
          {copy.attach.missing}
        </AppText>
        <AppText
          variant="sm"
          style={{ color: "#ffffffcc", textAlign: "center" }}
        >
          {copy.attach.missingHint}
        </AppText>
      </View>
    );
  }
  if (a.kind === "video") return <VideoPane key={uri} uri={uri} />;
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      aria-label={copy.attach.photo}
    />
  );
}

export default function MediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repo = useRepo();
  const snack = useSnackbar();
  const [confirm, setConfirm] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const { data } = useQuery(
    async (r) => {
      const a = await r.getAttachment(id);
      if (!a) return null;
      const note = await r.getNote(a.noteId);
      // Voice notes have their own player in the note; the viewer steps through pictures only.
      const list = (note?.attachments ?? [a]).filter((x) => isVisual(x.kind));
      return { a, list, editable: note?.deletedAt === null, note };
    },
    [id],
  );
  const photoText =
    data?.a.kind === "image" && data.a.text ? data.a.text : null;

  const copyText = async () => {
    if (!photoText) return;
    await Clipboard.setStringAsync(photoText);
    setTextOpen(false);
    snack(copy.photoText.copied);
  };

  // Into the note: a new paragraph in a text note, one item per line in a list.
  const addToNote = async () => {
    const n = data?.note;
    if (!photoText || !n) return;
    if (n.type === "checklist") {
      for (const line of photoText.split("\n").filter((l) => l.trim()))
        await repo.addItem(n.id, { text: line.trim() });
    } else {
      await repo.updateNote(n.id, {
        body: n.body.trim() ? `${n.body.trimEnd()}\n\n${photoText}` : photoText,
      });
    }
    setTextOpen(false);
    snack(copy.photoText.added);
  };

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  const at = data ? data.list.findIndex((x) => x.id === data.a.id) : -1;
  const go = (d: number) => {
    const next = data?.list[at + d];
    if (next) router.setParams({ id: next.id });
  };

  const remove = async () => {
    if (!data) return;
    const neighbour = data.list[at + 1] ?? data.list[at - 1];
    setConfirm(false);
    await repo.removeAttachment(data.a.id);
    await sweepUnusedFiles(repo, appFileStore()).catch(() => undefined);
    snack(copy.attach.removed);
    if (neighbour) router.setParams({ id: neighbour.id });
    else close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />
      {data ? <Media key={data.a.id} a={data.a} /> : null}
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <DarkButton icon={X} label={copy.common.close} onPress={close} />
          <AppText
            weight="600"
            role="heading"
            style={{ color: "#ffffff", flex: 1, textAlign: "center" }}
            numberOfLines={1}
          >
            {data && isVisual(data.a.kind)
              ? copy.attach.open(data.a.kind, at + 1, data.list.length)
              : ""}
          </AppText>
          {data?.editable ? (
            <DarkButton
              icon={Trash2}
              label={copy.attach.remove}
              onPress={() => setConfirm(true)}
            />
          ) : (
            <View style={styles.btn} />
          )}
        </View>
        {photoText ? (
          <View style={styles.bottom} pointerEvents="box-none">
            <Pressable
              role="button"
              aria-label={copy.photoText.button}
              onPress={() => setTextOpen(true)}
              style={(s: PState) => [
                styles.pill,
                {
                  backgroundColor: withAlpha(
                    "#ffffff",
                    s.pressed || s.hovered ? 0.3 : 0.18,
                  ),
                },
              ]}
            >
              <ScanText size={20} color="#ffffff" />
              <AppText weight="600" style={{ color: "#ffffff" }}>
                {copy.photoText.button}
              </AppText>
            </Pressable>
          </View>
        ) : null}
        {data && data.list.length > 1 ? (
          <View style={styles.nav} pointerEvents="box-none">
            <DarkButton
              icon={ChevronLeft}
              label={copy.attach.previous}
              onPress={() => go(-1)}
              disabled={at <= 0}
            />
            <DarkButton
              icon={ChevronRight}
              label={copy.attach.next}
              onPress={() => go(1)}
              disabled={at >= data.list.length - 1}
            />
          </View>
        ) : null}
      </SafeAreaView>
      {/* Mounted only while open: on web the newest modal is the one named as a dialog. */}
      {textOpen ? (
        <BottomSheet
          open
          onClose={() => setTextOpen(false)}
          title={copy.photoText.title}
        >
          <ScrollView
            style={{ maxHeight: 280 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          >
            <AppText selectable>{photoText ?? ""}</AppText>
          </ScrollView>
          <SheetRow
            icon={Copy}
            label={copy.photoText.copy}
            onPress={copyText}
          />
          {data?.editable ? (
            <SheetRow
              icon={TextCursorInput}
              label={copy.photoText.addToNote}
              onPress={addToNote}
            />
          ) : null}
        </BottomSheet>
      ) : null}
      <Dialog
        open={confirm}
        title={copy.attach.removeTitle}
        body={copy.attach.removeBody}
        cancel={{ label: copy.common.cancel, onPress: () => setConfirm(false) }}
        confirm={{
          label: copy.attach.remove,
          onPress: remove,
          variant: "danger",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  // At the sides, clear of the video's own controls.
  nav: {
    position: "absolute",
    left: 8,
    right: 8,
    top: "50%",
    marginTop: -24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 48,
    borderRadius: 24,
  },
});
