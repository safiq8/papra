import type { Component } from 'solid-js';
import type { Document } from '../documents.types';
import { useMutation, useQueryClient } from '@tanstack/solid-query';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { createMemo, createSignal, Show } from 'solid-js';
import { useConfig } from '@/modules/config/config.provider';
import { useI18n } from '@/modules/i18n/i18n.provider';
import { Alert, AlertDescription } from '@/modules/ui/components/alert';
import { Button } from '@/modules/ui/components/button';
import { createToast } from '@/modules/ui/components/sonner';
import { TextArea } from '@/modules/ui/components/textarea';
import { TextFieldRoot } from '@/modules/ui/components/textfield';
import { useReprocessDocument } from '../documents.composables';
import { updateDocument } from '../documents.services';

export const DocumentContentEditionPanel: Component<{ document: Document }> = (props) => {
  const { t } = useI18n();
  const { config } = useConfig();
  const { reprocess, getIsReprocessing } = useReprocessDocument();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = createSignal(false);
  const [getContent, setContent] = createSignal(props.document.content);
  const renderedContent = createMemo(() =>
    DOMPurify.sanitize(marked.parse(props.document.content ?? '', { async: false })),
  );

  const downloadMarkdown = () => {
    const url = URL.createObjectURL(
      new Blob([props.document.content ?? ''], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    const name = props.document.name
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
    link.download = `${name || 'document'}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateMutation = useMutation(() => ({
    mutationFn: async ({ content }: { content: string }) =>
      updateDocument({
        documentId: props.document.id,
        organizationId: props.document.organizationId,
        content,
      }),
    onSuccess: () => {
      createToast({ type: 'success', message: 'Document content updated' });
      setIsEditing(false);
      void queryClient.invalidateQueries({
        queryKey: ['organizations', props.document.organizationId, 'documents', props.document.id],
      });
    },
    onError: () => {
      createToast({ type: 'error', message: 'Failed to update document content' });
    },
  }));

  const handleEdit = () => {
    setContent(props.document.content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setContent(props.document.content);
  };

  const handleSave = () => {
    updateMutation.mutate({ content: getContent() });
  };

  return (
    <div class="flex flex-col gap-2">
      <Show
        when={isEditing()}
        fallback={
          <Show
            when={props.document.content}
            fallback={
              <p class="text-muted-foreground italic">{t('documents.content.empty-placeholder')}</p>
            }
          >
            <div
              class="markdown-content rounded-md border p-4 max-h-500px overflow-auto break-words"
              innerHTML={renderedContent()}
            />
          </Show>
        }
      >
        <TextFieldRoot>
          <TextArea
            value={isEditing() ? getContent() : props.document.content}
            onInput={(e) => setContent(e.currentTarget.value)}
            class="font-mono placeholder:italic max-h-500px"
            readonly={!isEditing()}
            placeholder={t('documents.content.empty-placeholder')}
            rows={2}
            autoResize
          />
        </TextFieldRoot>
      </Show>
      <div class="flex flex-wrap justify-end gap-2">
        <Show when={!isEditing()}>
          <Button variant="outline" onClick={downloadMarkdown} disabled={!props.document.content}>
            <div class="i-tabler-download size-4 mr-2" />
            Download .md
          </Button>
        </Show>
        <Show
          when={config.documents.isReprocessingEnabled && !props.document.isDeleted && !isEditing()}
        >
          <Button
            variant="outline"
            onClick={async () => reprocess({ document: props.document })}
            isLoading={getIsReprocessing()}
          >
            <div class="i-tabler-refresh size-4 mr-2" />
            {t('documents.reprocess.action')}
          </Button>
        </Show>
        <Show
          when={isEditing()}
          fallback={
            <Button variant="outline" onClick={handleEdit} disabled={getIsReprocessing()}>
              <div class="i-tabler-edit size-4 mr-2" />
              {t('documents.actions.edit')}
            </Button>
          }
        >
          <Button variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
            {t('documents.actions.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={updateMutation.isPending}>
            {updateMutation.isPending ? t('documents.actions.saving') : t('documents.actions.save')}
          </Button>
        </Show>
      </div>

      <Alert variant="muted" class="my-4 flex items-center gap-2">
        <div class="i-tabler-info-circle size-8 flex-shrink-0" />
        <AlertDescription>{t('documents.content.alert')}</AlertDescription>
      </Alert>
    </div>
  );
};
