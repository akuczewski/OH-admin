import {
    Button,
    Dialog,
    Field,
    Flex,
    TextInput,
    Typography
} from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { useState } from 'react';
// @ts-ignore
import { useFetchClient } from '@strapi/admin/strapi-admin';

const RecipeImporterButton = () => {
    // Only show this button on the Recipe collection page
    const isRecipePage = window.location.pathname.includes('api::recipe.recipe');

    const [isOpen, setIsOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const { post } = useFetchClient();

    if (!isRecipePage) {
        return null;
    }

    const handleImport = async () => {
        if (!url) return;
        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const { data } = await post('/ingredient-lookup/import-url', { url });
            setSuccessMsg(`Utworzono szkic: ${data.title} (${data.ingredientsFound} składników). Odśwież stronę.`);
            setUrl('');

            // Auto-refresh after 2 seconds to show the new draft in the list
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            console.error('[RECIPE-IMPORTER] Error:', err);
            setError(err.response?.data?.error?.message || err.message || 'Wystąpił błąd pobierania.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="secondary"
                startIcon={<Download />}
                onClick={() => setIsOpen(true)}
            >
                Importuj URL
            </Button>

            <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                <Dialog.Content>
                    <Dialog.Header>Narzędzie Importu Przepisu</Dialog.Header>
                    <Dialog.Body>
                        <Flex direction="column" alignItems="stretch" gap={4}>
                            <Typography variant="omega">
                                Wklej adres URL przepisu (np. z Kwestia Smaku, Moje Wypieki), a system spróbuje pobrać składniki i wygenerować Szkic przepisu.
                            </Typography>

                            <Field.Root name="recipe-url" error={error}>
                                <Field.Label>Adres URL Przepisu</Field.Label>
                                <TextInput
                                    placeholder="https://www.kwestiasmaku.com/przepis/..."
                                    value={url}
                                    onChange={(e: any) => setUrl(e.target.value)}
                                />
                                <Field.Error />
                            </Field.Root>

                            {successMsg && (
                                <Typography variant="pi" textColor="success600" fontWeight="bold">
                                    {successMsg}
                                </Typography>
                            )}
                        </Flex>
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Dialog.Cancel>
                            <Button variant="tertiary" onClick={() => setIsOpen(false)}>Anuluj</Button>
                        </Dialog.Cancel>
                        <Dialog.Action>
                            <Button onClick={handleImport} loading={isLoading} disabled={!url || !!successMsg}>
                                Pobierz i Stwórz Szkic
                            </Button>
                        </Dialog.Action>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        </>
    );
};

export default RecipeImporterButton;
