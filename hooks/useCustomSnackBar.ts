import { VariantType, useSnackbar } from "notistack";

/**
 * In the future, add more opts to hooks
 * @returns
 */
export const useCustomSnackBar = () => {
  const { enqueueSnackbar } = useSnackbar();
  const handleNotification = (message: string, variant: VariantType) => {
    enqueueSnackbar(message, {
      variant,
      anchorOrigin: { vertical: "top", horizontal: "right" },
    });
  };

  return { handleNotification };
};
