(function () {
  const SNAP_THRESHOLD = 8;
  const GRID_SIZE = 24;
  const INITIAL_ITEM_MAX_SIZE = 220;
  const INITIAL_ITEM_MIN_SIZE = 96;
  const INITIAL_ITEM_SCALE = 0.72;
  const IMPORT_BASE_OFFSET = 96;
  const IMPORT_OFFSET_STEP = 42;
  const LINE_CUT_PREVIEW_OVERLAY_ROLE = 'data-role="line-cut-preview-overlay"';
  const LINE_CUT_DRAG_HANDLE_ROLE = 'data-role="line-cut-drag-handle"';
  const SLICE_PREVIEW_OVERLAY_ROLE = 'data-role="slice-preview-overlay"';
  const SLICE_PREVIEW_COUNT_ROLE = 'data-role="slice-preview-count"';
  const EXPORT_SELECTION_BOUNDS_ROLE = 'data-role="export-selection-bounds"';

  const state = {
    mode: document.body.dataset.mode || "standalone",
    viewport: { zoom: 1, x: 0, y: 0 },
    assets: [],
    items: [],
    activeSelection: null,
    selectedIds: [],
    marqueeSelection: null,
    exportFormat: "jpg",
    cropMode: false,
    sliceMode: false,
    sliceDraft: null,
    lineCutMode: false,
    lineCutDraft: null,
    snapGuides: { x: null, y: null }
  };

  const refs = {
    fileInput: document.querySelector('[data-role="file-input"]'),
    assetList: document.querySelector('[data-role="asset-list"]'),
    canvasSurface: document.querySelector('[data-role="canvas-surface"]'),
    canvasItems: document.querySelector('[data-role="canvas-items"]'),
    canvasEmpty: document.querySelector('[data-role="canvas-empty"]'),
    selectionOverlay: document.querySelector('[data-role="selection-overlay"]'),
    noticeRegion: document.querySelector('[data-role="notice-region"]'),
    zoomLabel: document.querySelector('[data-role="zoom-label"]'),
    selectionHint: document.querySelector('[data-role="selection-hint"]'),
    cropModeHint: document.querySelector('[data-role="crop-mode-hint"]'),
    normalInspector: document.querySelector('[data-role="normal-inspector"]'),
    lineCutPanel: document.querySelector('[data-role="line-cut-panel"]'),
    lineCutHint: document.querySelector('[data-role="line-cut-hint"]'),
    slicePanel: document.querySelector('[data-role="slice-panel"]'),
    sliceGridFields: document.querySelector('[data-role="slice-grid-fields"]'),
    sliceGuideFields: document.querySelector('[data-role="slice-guide-fields"]'),
    sliceHint: document.querySelector('[data-role="slice-hint"]'),
    contextMenu: document.querySelector('[data-role="canvas-context-menu"]'),
    contextOpenLineCut: document.querySelector('[data-action="context-open-line-cut"]'),
    contextOpenSlice: document.querySelector('[data-action="context-open-slice"]'),
    contextToggleCrop: document.querySelector('[data-action="context-toggle-crop"]'),
    contextBringForward: document.querySelector('[data-action="context-bring-forward"]'),
    contextSendBackward: document.querySelector('[data-action="context-send-backward"]'),
    contextExportSelection: document.querySelector('[data-action="context-export-selection"]'),
    contextDeleteItem: document.querySelector('[data-action="context-delete-item"]'),
    addSliceVerticalGuide: document.querySelector('[data-action="add-slice-vertical-guide"]'),
    addSliceHorizontalGuide: document.querySelector('[data-action="add-slice-horizontal-guide"]'),
    clearSliceVerticalGuides: document.querySelector('[data-action="clear-slice-vertical-guides"]'),
    clearSliceHorizontalGuides: document.querySelector('[data-action="clear-slice-horizontal-guides"]'),
    confirmLineCut: document.querySelector('[data-action="confirm-line-cut"]'),
    cancelLineCut: document.querySelector('[data-action="cancel-line-cut"]'),
    confirmSlice: document.querySelector('[data-action="confirm-slice"]'),
    cancelSlice: document.querySelector('[data-action="cancel-slice"]'),
    exportFormat: document.querySelector('[data-field="export-format"]'),
    exportMerged: document.querySelector('[data-action="export-merged"]'),
    exportIndividual: document.querySelector('[data-action="export-individual"]'),
    fields: {
      x: document.querySelector('[data-field="pos-x"]'),
      y: document.querySelector('[data-field="pos-y"]'),
      width: document.querySelector('[data-field="width"]'),
      height: document.querySelector('[data-field="height"]'),
      rotation: document.querySelector('[data-field="rotation"]'),
      cropX: document.querySelector('[data-field="crop-x"]'),
      cropY: document.querySelector('[data-field="crop-y"]'),
      cropWidth: document.querySelector('[data-field="crop-width"]'),
      cropHeight: document.querySelector('[data-field="crop-height"]'),
      sliceMode: document.querySelector('[data-field="slice-mode"]'),
      sliceRows: document.querySelector('[data-field="slice-rows"]'),
      sliceCols: document.querySelector('[data-field="slice-cols"]'),
      sliceVerticalGuides: document.querySelector('[data-field="slice-vertical-guides"]'),
      sliceHorizontalGuides: document.querySelector('[data-field="slice-horizontal-guides"]')
    }
  };

  let dragState = null;
  let panState = null;
  let cropDragState = null;
  let guideDragState = null;
  let lineCutDragState = null;
  let contextMenuState = null;
  let noticeDismissTimer = null;

  function init() {
    bindToolbar();
    bindFields();
    bindCanvas();
    updateInspector();
    render();
  }

  function bindToolbar() {
    document.querySelector('[data-action="pick-images"]').addEventListener("click", () => {
      refs.fileInput.click();
    });

    document.querySelector('[data-action="reset-view"]').addEventListener("click", () => {
      state.viewport = { zoom: 1, x: 0, y: 0 };
      renderCanvas();
    });

    document.querySelector('[data-action="bring-forward"]').addEventListener("click", () => {
      bringSelectionForward();
    });

    document.querySelector('[data-action="send-backward"]').addEventListener("click", () => {
      sendSelectionBackward();
    });

    document.querySelector('[data-action="delete-item"]').addEventListener("click", () => {
      deleteSelection();
    });

    document.querySelector('[data-action="toggle-crop-mode"]').addEventListener("click", () => {
      toggleCropModeForSelection();
    });

    document.querySelector('[data-action="reset-crop"]').addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.crop = {
        x: 0,
        y: 0,
        width: item.naturalWidth,
        height: item.naturalHeight
      };
      render();
    });

    document.querySelector('[data-action="open-slice-mode"]').addEventListener("click", () => {
      if (!canSliceSelectedItem()) return;
      enterSliceMode();
      render();
    });

    document.querySelector('[data-action="open-line-cut-mode"]').addEventListener("click", () => {
      if (!canLineCutSelectedItem()) return;
      enterLineCutMode();
      render();
    });

    refs.contextOpenLineCut.addEventListener("click", () => executeContextMenuAction("line-cut"));
    refs.contextOpenSlice.addEventListener("click", () => executeContextMenuAction("slice"));
    refs.contextToggleCrop.addEventListener("click", () => executeContextMenuAction("crop"));
    refs.contextBringForward.addEventListener("click", () => {
      closeContextMenu();
      bringSelectionForward();
    });
    refs.contextSendBackward.addEventListener("click", () => {
      closeContextMenu();
      sendSelectionBackward();
    });
    refs.contextExportSelection.addEventListener("click", () => {
      closeContextMenu();
      exportSelectedAsMergedImage();
    });
    refs.contextDeleteItem.addEventListener("click", () => {
      closeContextMenu();
      deleteSelection();
    });

    document.querySelector('[data-action="add-slice-vertical-guide"]').addEventListener("click", () => {
      requestSliceGuidePlacement("vertical");
      render();
    });

    document.querySelector('[data-action="add-slice-horizontal-guide"]').addEventListener("click", () => {
      requestSliceGuidePlacement("horizontal");
      render();
    });

    document.querySelector('[data-action="clear-slice-vertical-guides"]').addEventListener("click", () => {
      clearSliceGuides("vertical");
      render();
    });

    document.querySelector('[data-action="clear-slice-horizontal-guides"]').addEventListener("click", () => {
      clearSliceGuides("horizontal");
      render();
    });

    document.querySelector('[data-action="confirm-line-cut"]').addEventListener("click", () => {
      confirmLineCut();
      render();
    });

    document.querySelector('[data-action="cancel-line-cut"]').addEventListener("click", () => {
      cancelLineCut();
      render();
    });

    document.querySelector('[data-action="confirm-slice"]').addEventListener("click", () => {
      confirmSlice();
      render();
    });

    document.querySelector('[data-action="cancel-slice"]').addEventListener("click", () => {
      cancelSlice();
      render();
    });

    refs.exportMerged.addEventListener("click", exportSelectedAsMergedImage);
    refs.exportIndividual.addEventListener("click", exportSelectedAsSeparateImages);

    refs.exportFormat.addEventListener("change", () => {
      state.exportFormat = refs.exportFormat.value;
    });

    refs.fileInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      await importFiles(files);
      refs.fileInput.value = "";
    });
  }

  function bindFields() {
    refs.fields.x.addEventListener("input", () => updateSelectedNumeric("x", refs.fields.x.value));
    refs.fields.y.addEventListener("input", () => updateSelectedNumeric("y", refs.fields.y.value));
    refs.fields.width.addEventListener("input", () => updateSelectedNumeric("width", refs.fields.width.value, 1));
    refs.fields.height.addEventListener("input", () => updateSelectedNumeric("height", refs.fields.height.value, 1));
    refs.fields.rotation.addEventListener("input", () => updateSelectedNumeric("rotation", refs.fields.rotation.value));
    refs.fields.cropX.addEventListener("input", () => updateSelectedCrop("x", refs.fields.cropX.value));
    refs.fields.cropY.addEventListener("input", () => updateSelectedCrop("y", refs.fields.cropY.value));
    refs.fields.cropWidth.addEventListener("input", () => updateSelectedCrop("width", refs.fields.cropWidth.value, 1));
    refs.fields.cropHeight.addEventListener("input", () => updateSelectedCrop("height", refs.fields.cropHeight.value, 1));
    refs.fields.sliceMode.addEventListener("change", () => {
      if (!state.sliceDraft) return;
      state.sliceDraft.mode = refs.fields.sliceMode.value;
      state.sliceDraft.pendingGuideAxis = null;
      if (state.sliceDraft.mode === "grid") {
        updateSliceDraftFromGrid();
      } else {
        updateSliceDraftFromGuides();
      }
      render();
    });
    refs.fields.sliceRows.addEventListener("input", () => {
      updateSliceDraftFromGrid();
      render();
    });
    refs.fields.sliceCols.addEventListener("input", () => {
      updateSliceDraftFromGrid();
      render();
    });
    refs.fields.sliceVerticalGuides.addEventListener("input", () => {
      updateSliceDraftFromGuides();
      render();
    });
    refs.fields.sliceHorizontalGuides.addEventListener("input", () => {
      updateSliceDraftFromGuides();
      render();
    });
  }

  function bindCanvas() {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        handleLineCutCancelFromContext(event);
      }
    });

    refs.canvasSurface.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    refs.canvasSurface.addEventListener("pointerdown", (event) => {
      if (event.button !== 2) {
        closeContextMenu();
      }
      if (cropDragState) return;
      if (state.lineCutMode && event.button === 2) {
        handleLineCutCancelFromContext(event);
        return;
      }
      if (event.button === 1) {
        startViewportPan(event);
        return;
      }
      if (event.button !== 0) return;
      if (state.lineCutMode) {
        handleLineCutCancelFromContext(event);
        return;
      }
      if (event.target.closest(".canvas-item")) return;
      startMarqueeSelection(event);
    });

    refs.canvasSurface.addEventListener("pointermove", (event) => {
      if (!panState || panState.pointerId !== event.pointerId) return;
      state.viewport.x = panState.originX + (event.clientX - panState.startX);
      state.viewport.y = panState.originY + (event.clientY - panState.startY);
      renderCanvas();
    });

    refs.canvasSurface.addEventListener("pointerup", (event) => {
      if (panState && panState.pointerId === event.pointerId) {
        finishViewportPan(event.pointerId);
      }
    });

    refs.canvasSurface.addEventListener("pointercancel", (event) => {
      if (panState && panState.pointerId === event.pointerId) {
        finishViewportPan(event.pointerId);
      }
    });

    refs.canvasSurface.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const nextZoom = state.viewport.zoom * (event.deltaY < 0 ? 1.1 : 0.9);
        zoomViewportAt(event.clientX, event.clientY, nextZoom);
      },
      { passive: false }
    );
  }

  async function importFiles(files) {
    let lastId = null;
    const startIndex = visibleCanvasItems().length;

    for (const [index, file] of files.entries()) {
      const objectUrl = URL.createObjectURL(file);
      const img = await loadImage(objectUrl);
      const asset = {
        id: `asset-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        src: objectUrl,
        naturalWidth: img.width,
        naturalHeight: img.height
      };
      state.assets.push(asset);
      const item = createCanvasItemFromAsset(asset, startIndex + index);
      lastId = item.id;
      state.items.push(item);
    }

    if (lastId) {
      setSingleSelection(lastId);
    }

    render();
  }

  function render() {
    renderAssets();
    renderCanvas();
    updateInspector();
    updateLineCutPanel();
    updateSlicePanel();
    updateContextMenuState();
  }

  function showNotice(message) {
    if (!refs.noticeRegion || !message) return;
    if (noticeDismissTimer) {
      window.clearTimeout(noticeDismissTimer);
      noticeDismissTimer = null;
    }

    refs.noticeRegion.innerHTML = "";
    const notice = document.createElement("div");
    notice.className = "notice-chip";
    notice.textContent = message;
    refs.noticeRegion.appendChild(notice);

    noticeDismissTimer = window.setTimeout(() => {
      refs.noticeRegion.innerHTML = "";
      noticeDismissTimer = null;
    }, 2400);
  }

  function renderAssets() {
    refs.assetList.innerHTML = "";
    const previewAssetIds = currentSelectionAssetIds();

    state.assets
      .slice()
      .forEach((asset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `asset-card${previewAssetIds.includes(asset.id) ? " is-selected" : ""}`;
        button.innerHTML = `
          <img src="${asset.src}" alt="${escapeHtml(asset.name)}">
          <span>${escapeHtml(asset.name)}</span>
        `;
        button.addEventListener("click", () => {
          const item = createCanvasItemFromAsset(asset, visibleCanvasItems().length);
          state.items.push(item);
          normalizeZOrder();
          setSingleSelection(item.id);
          render();
        });
        refs.assetList.appendChild(button);
      });
  }

  function renderCanvas() {
    refs.canvasItems.innerHTML = "";
    refs.selectionOverlay.innerHTML = "";
    refs.canvasItems.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`;
    refs.zoomLabel.textContent = `缩放 ${Math.round(state.viewport.zoom * 100)}%`;
    refs.canvasEmpty.hidden = visibleCanvasItems().length > 0;

    const previewIds = currentSelectionIds();

    visibleCanvasItems()
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((item) => {
        const node = document.createElement("div");
        const isSelected = previewIds.includes(item.id);
        const cropModeActive = state.cropMode && isSingleSelection() && item.id === state.activeSelection;
        const sliceModeActive = state.sliceMode && state.sliceDraft && item.id === state.sliceDraft.itemId;
        const lineCutModeActive = state.lineCutMode && state.lineCutDraft && item.id === state.lineCutDraft.itemId;
        node.className = `canvas-item${isSelected ? " is-selected" : ""}${cropModeActive ? " is-crop-mode" : ""}`;
        node.style.width = `${item.width}px`;
        node.style.height = `${item.height}px`;
        node.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;
        node.dataset.itemId = item.id;

        if (isPolygonImageItem(item)) {
          renderPolygonItem(node, item);
        } else {
          const image = document.createElement("img");
          image.src = item.src;
          image.alt = item.name;
          applyCropStyle(image, item, cropModeActive);
          node.appendChild(image);
        }

        if (cropModeActive) {
          node.appendChild(buildCropOverlay(item));
        }
        if (lineCutModeActive) {
          node.appendChild(renderLineCutPreview(item));
        }
        if (sliceModeActive) {
          node.appendChild(renderSlicePreview(item));
        }

        node.addEventListener("pointerdown", (event) => {
          if (event.button === 2) {
            handleItemContextMenu(event, item);
            return;
          }
          if (event.button === 1) {
            startViewportPan(event);
            return;
          }
          if (event.button !== 0) return;
          if (lineCutModeActive) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (sliceModeActive) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (cropModeActive) {
            startCropDrag(event, item, node);
            return;
          }
          startItemDrag(event, item);
        });
        refs.canvasItems.appendChild(node);
      });

    renderSnapGuides();
    renderExportSelectionBounds();
    renderMarqueeSelection();
  }

  function startItemDrag(event, item) {
    event.preventDefault();
    event.stopPropagation();

    if (!isSelected(item.id)) {
      setSingleSelection(item.id);
    }

    const dragIds = state.selectedIds.slice();
    dragState = {
      pointerId: event.pointerId,
      itemIds: dragIds,
      startX: event.clientX,
      startY: event.clientY,
      origins: captureItemOrigins(dragIds),
      originBounds: computeBoundsForItems(itemsByIds(dragIds))
    };

    renderAssets();
    updateInspector();
    window.addEventListener("pointermove", handleItemDragMove);
    window.addEventListener("pointerup", handleItemDragEnd);
    window.addEventListener("pointercancel", handleItemDragEnd);
  }

  function startCropDrag(event, item, node) {
    event.preventDefault();
    event.stopPropagation();
    setSingleSelection(item.id);
    const rect = node.getBoundingClientRect();
    const start = pointerToLocal(event, rect);
    cropDragState = {
      pointerId: event.pointerId,
      itemId: item.id,
      start,
      originCrop: { ...item.crop },
      rect
    };

    updateInspector();
    window.addEventListener("pointermove", handleCropDragMove);
    window.addEventListener("pointerup", handleCropDragEnd);
    window.addEventListener("pointercancel", handleCropDragEnd);
  }

  function startMarqueeSelection(event) {
    event.preventDefault();
    event.stopPropagation();
    clearSnapGuides();
    state.cropMode = false;
    state.marqueeSelection = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
      hitIds: []
    };

    refs.canvasSurface.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", updateMarqueeSelection);
    window.addEventListener("pointerup", finalizeMarqueeSelection);
    window.addEventListener("pointercancel", finalizeMarqueeSelection);
    renderCanvas();
  }

  function updateMarqueeSelection(event) {
    if (!state.marqueeSelection || state.marqueeSelection.pointerId !== event.pointerId) return;
    state.marqueeSelection.currentClientX = event.clientX;
    state.marqueeSelection.currentClientY = event.clientY;
    state.marqueeSelection.hitIds = computeMarqueeSelectionIds(state.marqueeSelection);
    renderCanvas();
  }

  function finalizeMarqueeSelection(event) {
    if (!state.marqueeSelection || state.marqueeSelection.pointerId !== event.pointerId) return;

    const selection = state.marqueeSelection;
    state.marqueeSelection = null;
    window.removeEventListener("pointermove", updateMarqueeSelection);
    window.removeEventListener("pointerup", finalizeMarqueeSelection);
    window.removeEventListener("pointercancel", finalizeMarqueeSelection);
    if (refs.canvasSurface.hasPointerCapture(event.pointerId)) {
      refs.canvasSurface.releasePointerCapture(event.pointerId);
    }

    const rect = marqueeClientRect(selection);
    if (rect.width < 4 && rect.height < 4) {
      clearSelection();
    } else {
      setSelection(selection.hitIds, selection.hitIds[selection.hitIds.length - 1] || null);
    }

    render();
  }

  function handleItemDragMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const bounds = dragState.originBounds;
    if (!bounds) return;

    const nextX = bounds.minX + (event.clientX - dragState.startX) / state.viewport.zoom;
    const nextY = bounds.minY + (event.clientY - dragState.startY) / state.viewport.zoom;
    const snapped = applyDragSnapping(
      { width: bounds.width, height: bounds.height },
      nextX,
      nextY,
      dragState.itemIds
    );

    moveSelectedItems(
      dragState.itemIds,
      dragState.origins,
      snapped.x - bounds.minX,
      snapped.y - bounds.minY
    );
    renderCanvas();
    updateInspector();
  }

  function handleItemDragEnd(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", handleItemDragMove);
    window.removeEventListener("pointerup", handleItemDragEnd);
    window.removeEventListener("pointercancel", handleItemDragEnd);
    clearSnapGuides();
    dragState = null;
    renderCanvas();
  }

  function handleCropDragMove(event) {
    if (!cropDragState || cropDragState.pointerId !== event.pointerId) return;
    const item = state.items.find((entry) => entry.id === cropDragState.itemId);
    if (!item) return;

    const end = pointerToLocal(event, cropDragState.rect);
    item.crop = normalizeCropRect(cropDragState.start, end, cropDragState.originCrop, item);
    renderCanvas();
    updateInspector();
  }

  function handleCropDragEnd(event) {
    if (!cropDragState || cropDragState.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", handleCropDragMove);
    window.removeEventListener("pointerup", handleCropDragEnd);
    window.removeEventListener("pointercancel", handleCropDragEnd);
    cropDragState = null;
  }

  function startViewportPan(event) {
    event.preventDefault();
    event.stopPropagation();
    clearSnapGuides();
    closeContextMenu();
    panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.viewport.x,
      originY: state.viewport.y
    };
    refs.canvasSurface.setPointerCapture(event.pointerId);
  }

  function finishViewportPan(pointerId) {
    if (refs.canvasSurface.hasPointerCapture(pointerId)) {
      refs.canvasSurface.releasePointerCapture(pointerId);
    }
    panState = null;
  }

  function updateInspector() {
    const marqueeActive = Boolean(state.marqueeSelection);
    const item = marqueeActive ? null : selectedItem();
    const selectionCount = marqueeActive ? 0 : state.selectedIds.length;
    const singleSelection = !marqueeActive && isSingleSelection();

    refs.fields.x.value = item ? Math.round(item.x) : "";
    refs.fields.y.value = item ? Math.round(item.y) : "";
    refs.fields.width.value = item ? Math.round(item.width) : "";
    refs.fields.height.value = item ? Math.round(item.height) : "";
    refs.fields.rotation.value = item ? Math.round(item.rotation) : "";
    refs.fields.cropX.value = item ? Math.round(item.crop.x) : "";
    refs.fields.cropY.value = item ? Math.round(item.crop.y) : "";
    refs.fields.cropWidth.value = item ? Math.round(item.crop.width) : "";
    refs.fields.cropHeight.value = item ? Math.round(item.crop.height) : "";

    Object.values(refs.fields).forEach((field) => {
      field.disabled = !singleSelection;
    });

    document.querySelector('[data-action="bring-forward"]').disabled = !singleSelection;
    document.querySelector('[data-action="send-backward"]').disabled = !singleSelection;
    document.querySelector('[data-action="delete-item"]').disabled = selectionCount === 0;
    document.querySelector('[data-action="reset-crop"]').disabled = !singleSelection;
    document.querySelector('[data-action="toggle-crop-mode"]').disabled = !singleSelection;
    document.querySelector('[data-action="open-line-cut-mode"]').disabled = !canLineCutSelectedItem();
    document.querySelector('[data-action="open-slice-mode"]').disabled = !canSliceSelectedItem();
    refs.exportMerged.disabled = selectionCount === 0;
    refs.exportIndividual.disabled = selectionCount === 0;
    document.querySelector('[data-action="toggle-crop-mode"]').textContent = state.cropMode ? "退出裁剪" : "拖框裁剪";
    refs.cropModeHint.classList.toggle("is-active", state.cropMode && singleSelection);

    if (state.marqueeSelection) {
      refs.selectionHint.textContent = state.marqueeSelection.hitIds.length > 0
        ? `框选中: ${state.marqueeSelection.hitIds.length} 张图片`
        : "拖动鼠标左键框选图片。";
    } else if (selectionCount > 1) {
      refs.selectionHint.textContent = `已选中 ${selectionCount} 张图片，可整体移动或导出。`;
    } else if (item) {
      refs.selectionHint.textContent = `当前选中: ${item.name}`;
    } else {
      refs.selectionHint.textContent = "先选择或框选图片再编辑。";
    }

    refs.cropModeHint.textContent =
      state.cropMode && item
        ? "在画布里的图片上拖出新的裁剪框。"
        : "开启拖框裁剪后，在画布里的图片上拖出裁剪框。";
  }

  function canSliceSelectedItem() {
    const item = selectedItem();
    return Boolean(item) && Math.round(item.rotation) === 0 && !isPolygonImageItem(item);
  }

  function canLineCutSelectedItem() {
    const item = selectedItem();
    return Boolean(item) && Math.round(item.rotation) === 0 && !isPolygonImageItem(item);
  }

  function resolveLineCutBaseRect(item) {
    const sourceItem = item || selectedItem();
    if (!sourceItem) return null;

    return {
      x: 0,
      y: 0,
      width: Math.max(1, Math.round(sourceItem.crop.width)),
      height: Math.max(1, Math.round(sourceItem.crop.height))
    };
  }

  function resolveLineCutOrientation(event) {
    return event && event.shiftKey ? "horizontal" : "vertical";
  }

  function resolveLineCutOffset(item, orientation, event) {
    const point = resolveLineCutPointFromEvent(event, item);
    const baseRect = resolveLineCutBaseRect(item);
    if (!point || !baseRect) return null;

    return orientation === "horizontal"
      ? clamp(point.y, 0, baseRect.height)
      : clamp(point.x, 0, baseRect.width);
  }

  function splitRectPolygonByLine(baseRect, startPoint, endPoint) {
    if (!baseRect || !startPoint || !endPoint) return [];
    if (Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) < 0.5) return [];
    const rectPolygon = [
      { x: baseRect.x, y: baseRect.y },
      { x: baseRect.x + baseRect.width, y: baseRect.y },
      { x: baseRect.x + baseRect.width, y: baseRect.y + baseRect.height },
      { x: baseRect.x, y: baseRect.y + baseRect.height }
    ];
    const positivePolygon = clipPolygonAgainstLine(rectPolygon, startPoint, endPoint, true);
    const negativePolygon = clipPolygonAgainstLine(rectPolygon, startPoint, endPoint, false);

    return [positivePolygon, negativePolygon].filter((polygon) => polygon.length >= 3);
  }

  function validateLineCutPreview(preview) {
    const polygonCount = preview && Array.isArray(preview.polygons) ? preview.polygons.length : 0;
    const baseRect = preview ? preview.baseRect : null;
    const line = preview ? preview.line : null;
    const axisLimit = baseRect && line
      ? (line.orientation === "horizontal" ? baseRect.height : baseRect.width)
      : 0;
    const invalidEdge = !line || typeof line.offset !== "number" || line.offset <= 0 || line.offset >= axisLimit;
    const minimumArea = baseRect ? baseRect.width * baseRect.height * 0.01 : 0;
    const invalidArea = polygonCount === 2 && preview.polygons.some((polygon) => polygonArea(polygon) < minimumArea);

    return {
      isValid: polygonCount === 2 && !invalidArea && !invalidEdge,
      reason: polygonCount !== 2 ? "waiting-for-split" : (invalidEdge ? "edge" : (invalidArea ? "piece-too-small" : null))
    };
  }

  function buildAxisAlignedLineCutPreview(item, orientation, offset) {
    const sourceItem = item || selectedItem();
    const baseRect = resolveLineCutBaseRect(sourceItem);
    if (!sourceItem || !baseRect || typeof offset !== "number") {
      return {
        baseRect,
        line: { orientation, offset: null, start: null, end: null },
        polygons: [],
        validity: { isValid: false, reason: "waiting-for-split" }
      };
    }

    const startPoint = orientation === "horizontal"
      ? { x: 0, y: offset }
      : { x: offset, y: 0 };
    const endPoint = orientation === "horizontal"
      ? { x: baseRect.width, y: offset }
      : { x: offset, y: baseRect.height };

    const preview = {
      baseRect,
      line: {
        orientation,
        offset,
        start: startPoint,
        end: endPoint
      },
      polygons: splitRectPolygonByLine(baseRect, startPoint, endPoint),
      validity: { isValid: false, reason: "waiting-for-split" }
    };

    preview.validity = validateLineCutPreview(preview);
    return preview;
  }

  function updateLineCutDraft(partialDraft) {
    if (!state.lineCutDraft) return;
    Object.assign(state.lineCutDraft, partialDraft);
  }

  function updateLineCutPreview() {
    if (!state.lineCutDraft) return;
    state.lineCutDraft.preview = buildAxisAlignedLineCutPreview(
      lineCutSourceItem(),
      state.lineCutDraft.orientation,
      state.lineCutDraft.offset
    );
  }

  function canConfirmLineCut() {
    return Boolean(
      state.lineCutMode &&
      state.lineCutDraft &&
      state.lineCutDraft.placed &&
      state.lineCutDraft.preview &&
      state.lineCutDraft.preview.validity &&
      state.lineCutDraft.preview.validity.isValid
    );
  }

  function renderLineCutPreview() {
    const item = selectedItem();
    if (!item || !state.lineCutDraft) return null;

    const overlay = document.createElement("div");
    overlay.className = "line-cut-preview-overlay";
    overlay.setAttribute("data-role", "line-cut-preview-overlay");
    overlay.addEventListener("pointermove", (event) => {
      previewLineCutPlacement(event, item);
    });
    overlay.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".line-cut-drag-handle")) return;
      placeLineCut(event, item);
      render();
    });

    const preview = state.lineCutDraft.preview;
    if (preview && preview.line && preview.line.start && preview.line.end) {
      preview.polygons.forEach((polygon) => {
        const piece = document.createElement("div");
        piece.className = `line-cut-preview-piece${preview.validity.isValid ? "" : " is-invalid"}`;
        piece.style.clipPath = polygonToClipPath(
          polygon,
          Math.max(item.crop.width, 1),
          Math.max(item.crop.height, 1)
        );
        overlay.appendChild(piece);
      });
      renderLineCutPreviewLine(overlay, item, preview.line, preview.validity.isValid);
      if (state.lineCutDraft.placed) {
        renderLineCutDragHandle(overlay, item, preview.line, preview.validity.isValid);
      }
    }

    return overlay;
  }

  function renderLineCutPreviewLine(overlay, item, line, isValid) {
    if (!line || !line.start || !line.end) return;
    const start = cropPointToDisplayPoint(line.start, item);
    const end = cropPointToDisplayPoint(line.end, item);
    const previewLine = document.createElement("div");
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.hypot(end.x - start.x, end.y - start.y);

    previewLine.className = `line-cut-preview-line${isValid ? "" : " is-invalid"}`;
    previewLine.style.left = `${start.x}px`;
    previewLine.style.top = `${start.y}px`;
    previewLine.style.width = `${length}px`;
    previewLine.style.transform = `translateY(-1px) rotate(${angle}rad)`;
    overlay.appendChild(previewLine);
  }

  function renderLineCutDragHandle(overlay, item, line, isValid) {
    if (!line || !line.start || !line.end) return;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `line-cut-drag-handle is-${line.orientation}${isValid ? "" : " is-invalid"}`;
    handle.setAttribute("data-role", "line-cut-drag-handle");
    if (line.orientation === "horizontal") {
      handle.style.top = `${cropPointToDisplayPoint(line.start, item).y}px`;
    } else {
      handle.style.left = `${cropPointToDisplayPoint(line.start, item).x}px`;
    }
    handle.addEventListener("pointerdown", (event) => {
      startLineCutDrag(event, item);
    });
    overlay.appendChild(handle);
  }

  function previewLineCutPlacement(event, item) {
    if (!state.lineCutDraft || state.lineCutDraft.placed || state.lineCutDraft.isDragging) return;
    const orientation = resolveLineCutOrientation(event);
    const offset = resolveLineCutOffset(item, orientation, event);
    updateLineCutDraft({
      orientation,
      offset
    });
    updateLineCutPreview();
    render();
  }

  function placeLineCut(event, item) {
    if (!state.lineCutDraft) return;
    const orientation = resolveLineCutOrientation(event);
    const offset = resolveLineCutOffset(item, orientation, event);
    updateLineCutDraft({
      orientation,
      offset,
      placed: true
    });
    updateLineCutPreview();
  }

  function startLineCutDrag(event, item) {
    if (!state.lineCutDraft || !state.lineCutDraft.placed) return;
    event.preventDefault();
    event.stopPropagation();
    lineCutDragState = {
      pointerId: event.pointerId,
      itemId: item.id
    };
    state.lineCutDraft.isDragging = true;
    window.addEventListener("pointermove", handleLineCutDragMove);
    window.addEventListener("pointerup", handleLineCutDragEnd);
    window.addEventListener("pointercancel", handleLineCutDragEnd);
  }

  function handleLineCutDragMove(event) {
    if (!lineCutDragState || !state.lineCutDraft) return;
    const item = state.items.find((entry) => entry.id === lineCutDragState.itemId);
    if (!item) return;
    const offset = resolveLineCutOffset(item, state.lineCutDraft.orientation, event);
    updateLineCutDraft({ offset });
    updateLineCutPreview();
    render();
  }

  function handleLineCutDragEnd(event) {
    if (!lineCutDragState || (event && lineCutDragState.pointerId !== event.pointerId)) return;
    window.removeEventListener("pointermove", handleLineCutDragMove);
    window.removeEventListener("pointerup", handleLineCutDragEnd);
    window.removeEventListener("pointercancel", handleLineCutDragEnd);
    lineCutDragState = null;
    if (state.lineCutDraft) {
      state.lineCutDraft.isDragging = false;
    }
    render();
  }

  function updateLineCutPanel() {
    if (!refs.lineCutPanel || !refs.lineCutHint) return;

    refs.lineCutPanel.hidden = !state.lineCutMode;
    updateLineCutSectionVisibility();
    if (refs.confirmLineCut) {
      refs.confirmLineCut.disabled = !canConfirmLineCut();
    }
    if (refs.cancelLineCut) {
      refs.cancelLineCut.disabled = !state.lineCutMode;
    }

    if (!state.lineCutMode) {
      refs.lineCutHint.textContent = "选择单张未旋转图片后，可进入直线切割。";
    } else if (!state.lineCutDraft || !state.lineCutDraft.placed) {
      refs.lineCutHint.textContent = "点击生成竖线，按住 Shift 点击生成横线。";
    } else if (canConfirmLineCut()) {
      refs.lineCutHint.textContent = "拖动切线调整位置，Esc 取消。";
    } else {
      refs.lineCutHint.textContent = "当前切线太靠边，无法生成有效切割。";
    }
  }

  function updateLineCutSectionVisibility() {
    if (refs.normalInspector) {
      refs.normalInspector.hidden = state.sliceMode || state.lineCutMode;
    }
  }

  function handleLineCutCancelFromContext(event) {
    if (!state.lineCutMode) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    cancelLineCut();
    render();
  }

  function lineCutSourceItem() {
    if (!state.lineCutDraft) return null;
    return state.items.find((item) => item.id === state.lineCutDraft.itemId) || selectedItem();
  }

  function resolveLineCutPointFromEvent(event, item) {
    const currentTarget = event && event.currentTarget instanceof Element ? event.currentTarget : null;
    const node = (currentTarget ? currentTarget.closest(".canvas-item") : null) ||
      refs.canvasItems.querySelector(`[data-item-id="${item.id}"]`);
    const rect = node ? node.getBoundingClientRect() : refs.canvasSurface.getBoundingClientRect();
    const baseRect = resolveLineCutBaseRect(item);
    return {
      x: clamp(((event.clientX - rect.left) / Math.max(rect.width, 1)) * baseRect.width, 0, baseRect.width),
      y: clamp(((event.clientY - rect.top) / Math.max(rect.height, 1)) * baseRect.height, 0, baseRect.height)
    };
  }

  function cropPointToDisplayPoint(point, item) {
    return {
      x: (point.x / Math.max(item.crop.width, 1)) * item.width,
      y: (point.y / Math.max(item.crop.height, 1)) * item.height
    };
  }

  function polygonToClipPath(polygon, width, height) {
    return `polygon(${polygon.map((point) => (
      `${(point.x / Math.max(width, 1)) * 100}% ${(point.y / Math.max(height, 1)) * 100}%`
    )).join(", ")})`;
  }

  function polygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let total = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      total += current.x * next.y - next.x * current.y;
    }
    return Math.abs(total) / 2;
  }

  function signedLineDistance(startPoint, endPoint, point) {
    return (
      (endPoint.x - startPoint.x) * (point.y - startPoint.y) -
      (endPoint.y - startPoint.y) * (point.x - startPoint.x)
    );
  }

  function intersectSegmentWithLine(startPoint, endPoint, lineStart, lineEnd) {
    const startDistance = signedLineDistance(lineStart, lineEnd, startPoint);
    const endDistance = signedLineDistance(lineStart, lineEnd, endPoint);
    const ratio = startDistance / (startDistance - endDistance || 1);
    return {
      x: startPoint.x + (endPoint.x - startPoint.x) * ratio,
      y: startPoint.y + (endPoint.y - startPoint.y) * ratio
    };
  }

  function clipPolygonAgainstLine(polygon, lineStart, lineEnd, keepPositive) {
    const points = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const currentDistance = signedLineDistance(lineStart, lineEnd, current);
      const nextDistance = signedLineDistance(lineStart, lineEnd, next);
      const currentInside = keepPositive ? currentDistance >= -0.0001 : currentDistance <= 0.0001;
      const nextInside = keepPositive ? nextDistance >= -0.0001 : nextDistance <= 0.0001;

      if (currentInside) {
        points.push(current);
      }
      if (currentInside !== nextInside) {
        points.push(intersectSegmentWithLine(current, next, lineStart, lineEnd));
      }
    }
    return dedupePolygonPoints(points);
  }

  function dedupePolygonPoints(points) {
    return (points || []).filter((point, index, collection) => {
      const previous = collection[index - 1];
      if (!previous) return true;
      return Math.abs(previous.x - point.x) > 0.001 || Math.abs(previous.y - point.y) > 0.001;
    });
  }

  function updateSlicePanel() {
    if (!refs.slicePanel || !refs.sliceHint) return;

    const item = selectedItem();
    const gridModeActive = state.sliceMode && state.sliceDraft && state.sliceDraft.mode === "grid";
    const guidesModeActive = state.sliceMode && state.sliceDraft && state.sliceDraft.mode === "guides";
    const pendingGuideAxis = guidesModeActive ? state.sliceDraft.pendingGuideAxis : null;

    refs.slicePanel.hidden = !state.sliceMode;
    updateSliceSectionVisibility();

    if (refs.fields.sliceMode) {
      refs.fields.sliceMode.disabled = !state.sliceMode;
      refs.fields.sliceMode.value = state.sliceDraft ? state.sliceDraft.mode : "grid";
    }
    if (refs.fields.sliceRows) {
      refs.fields.sliceRows.disabled = !state.sliceMode || state.sliceDraft.mode !== "grid";
      refs.fields.sliceRows.value = state.sliceDraft ? state.sliceDraft.grid.rows : 1;
    }
    if (refs.fields.sliceCols) {
      refs.fields.sliceCols.disabled = !state.sliceMode || state.sliceDraft.mode !== "grid";
      refs.fields.sliceCols.value = state.sliceDraft ? state.sliceDraft.grid.cols : 1;
    }
    if (refs.fields.sliceVerticalGuides) {
      refs.fields.sliceVerticalGuides.disabled = !state.sliceMode || state.sliceDraft.mode !== "guides";
      refs.fields.sliceVerticalGuides.value = state.sliceDraft
        ? state.sliceDraft.guides.vertical.join(",")
        : "";
    }
    if (refs.fields.sliceHorizontalGuides) {
      refs.fields.sliceHorizontalGuides.disabled = !state.sliceMode || state.sliceDraft.mode !== "guides";
      refs.fields.sliceHorizontalGuides.value = state.sliceDraft
        ? state.sliceDraft.guides.horizontal.join(",")
        : "";
    }

    if (refs.addSliceVerticalGuide) {
      refs.addSliceVerticalGuide.disabled = !guidesModeActive;
      refs.addSliceVerticalGuide.classList.toggle("is-active", pendingGuideAxis === "vertical");
    }
    if (refs.addSliceHorizontalGuide) {
      refs.addSliceHorizontalGuide.disabled = !guidesModeActive;
      refs.addSliceHorizontalGuide.classList.toggle("is-active", pendingGuideAxis === "horizontal");
    }
    if (refs.clearSliceVerticalGuides) {
      refs.clearSliceVerticalGuides.disabled = !guidesModeActive || countSliceGuides("vertical") === 0;
    }
    if (refs.clearSliceHorizontalGuides) {
      refs.clearSliceHorizontalGuides.disabled = !guidesModeActive || countSliceGuides("horizontal") === 0;
    }
    if (refs.confirmSlice) {
      refs.confirmSlice.disabled = !canConfirmSlice();
    }
    if (refs.cancelSlice) {
      refs.cancelSlice.disabled = !state.sliceMode;
    }

    if (guidesModeActive && pendingGuideAxis === "vertical") {
      refs.sliceHint.textContent = `点击图片放置一条竖向参考线。当前预览 ${state.sliceDraft.previewRects.length} 片。`;
    } else if (guidesModeActive && pendingGuideAxis === "horizontal") {
      refs.sliceHint.textContent = `点击图片放置一条横向参考线。当前预览 ${state.sliceDraft.previewRects.length} 片。`;
    } else if (guidesModeActive) {
      refs.sliceHint.textContent = `参考线可输入、拖动，或先点添加再到图片上落线。当前预览 ${state.sliceDraft.previewRects.length} 片。`;
    } else if (gridModeActive) {
      refs.sliceHint.textContent = `调整行列后会实时预览。当前预览 ${state.sliceDraft.previewRects.length} 片。`;
    } else if (state.sliceMode) {
      refs.sliceHint.textContent = `切片后会在原位置生成多个独立图片块。当前预览 ${state.sliceDraft.previewRects.length} 片。`;
    } else if (item && Math.round(item.rotation) !== 0) {
      refs.sliceHint.textContent = "切片前请先将旋转恢复为 0 度。";
    } else {
      refs.sliceHint.textContent = "仅支持单选且未旋转图片进入切片。";
    }
  }

  function updateSliceSectionVisibility() {
    const gridModeActive = state.sliceMode && state.sliceDraft && state.sliceDraft.mode === "grid";
    const guidesModeActive = state.sliceMode && state.sliceDraft && state.sliceDraft.mode === "guides";

    if (refs.normalInspector) {
      refs.normalInspector.hidden = state.sliceMode || state.lineCutMode;
    }
    if (refs.sliceGridFields) {
      refs.sliceGridFields.hidden = !gridModeActive;
    }
    if (refs.sliceGuideFields) {
      refs.sliceGuideFields.hidden = !guidesModeActive;
    }
  }

  function countSliceGuides(axis) {
    if (!state.sliceDraft || !state.sliceDraft.guides) return 0;
    if (axis !== "vertical" && axis !== "horizontal") return 0;
    return state.sliceDraft.guides[axis].length;
  }

  function canConfirmSlice() {
    return Boolean(state.sliceMode && state.sliceDraft && state.sliceDraft.previewRects.length > 1);
  }

  function openContextMenu(clientX, clientY) {
    if (!refs.contextMenu) return;
    updateContextMenuState();
    refs.contextMenu.hidden = false;
    refs.contextMenu.style.display = "grid";
    refs.contextMenu.style.left = `${clientX}px`;
    refs.contextMenu.style.top = `${clientY}px`;
  }

  function closeContextMenu() {
    if (!refs.contextMenu) return;
    refs.contextMenu.hidden = true;
    refs.contextMenu.style.display = "none";
    contextMenuState = null;
  }

  function updateContextMenuState() {
    if (!refs.contextMenu) return;

    const targetItem = contextMenuTargetItem();
    const singleSelection = Boolean(targetItem) && state.selectedIds.length <= 1;
    const hasSelection = state.selectedIds.length > 0 || Boolean(targetItem);
    const multiSelection = state.selectedIds.length > 1 && !targetItem;
    const targetType = contextMenuTargetItemType();
    const polygonTarget = targetType === "polygon-image";
    refs.contextOpenLineCut.disabled = !canOpenLineCutFromContext(targetItem);
    refs.contextOpenLineCut.hidden = !singleSelection || polygonTarget;
    refs.contextOpenSlice.disabled = !canSliceTargetItem(targetItem);
    refs.contextOpenSlice.hidden = !singleSelection || polygonTarget;
    refs.contextToggleCrop.disabled = !singleSelection || polygonTarget;
    refs.contextToggleCrop.hidden = !singleSelection || polygonTarget;
    refs.contextToggleCrop.textContent = state.cropMode && singleSelection ? "退出裁剪" : "拖框裁剪";
    refs.contextBringForward.disabled = !singleSelection;
    refs.contextBringForward.hidden = !singleSelection;
    refs.contextSendBackward.disabled = !singleSelection;
    refs.contextSendBackward.hidden = !singleSelection;
    refs.contextExportSelection.disabled = !hasSelection;
    refs.contextExportSelection.hidden = !hasSelection;
    refs.contextExportSelection.textContent = multiSelection ? "导出选中" : "导出图片";
    refs.contextDeleteItem.disabled = !hasSelection;
    refs.contextDeleteItem.hidden = !hasSelection;
    refs.contextDeleteItem.textContent = multiSelection ? "删除选中" : "删除图片";
  }

  function contextMenuTargetItem() {
    if (!contextMenuState || !contextMenuState.itemId) return null;
    return state.items.find((item) => item.id === contextMenuState.itemId) || null;
  }

  function contextMenuTargetItemType() {
    const item = contextMenuTargetItem();
    return item ? item.type || "image" : null;
  }

  function canSliceTargetItem(item) {
    if (!item) return canSliceSelectedItem();
    return Math.round(item.rotation) === 0 && !isPolygonImageItem(item);
  }

  function canOpenLineCutFromContext(item) {
    if (!item) return canLineCutSelectedItem();
    return Math.round(item.rotation) === 0 && !isPolygonImageItem(item);
  }

  function executeContextMenuAction(action) {
    const targetItem = contextMenuTargetItem();
    switch (action) {
      case "line-cut":
        if (!applyContextMenuTargetSelection() || !canLineCutSelectedItem()) return;
        closeContextMenu();
        enterLineCutMode();
        render();
        return;
      case "slice":
        if (!applyContextMenuTargetSelection() || !canSliceTargetItem(targetItem || selectedItem())) return;
        closeContextMenu();
        enterSliceMode();
        render();
        return;
      case "crop":
        if (!applyContextMenuTargetSelection()) return;
        closeContextMenu();
        toggleCropModeForSelection();
        return;
      case "bring-forward":
        closeContextMenu();
        bringSelectionForward();
        return;
      case "send-backward":
        closeContextMenu();
        sendSelectionBackward();
        return;
      case "delete":
        closeContextMenu();
        deleteSelection();
        return;
      case "export":
        closeContextMenu();
        exportSelectedAsMergedImage();
        return;
      default:
        break;
    }
  }

  function handleItemContextMenu(event, item) {
    if (state.lineCutMode) {
      handleLineCutCancelFromContext(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    contextMenuState = {
      itemId: item.id
    };
    if (isSelected(item.id)) {
      contextMenuState.itemId = state.selectedIds.length === 1 ? item.id : null;
    }
    openContextMenu(event.clientX, event.clientY);
    render();
  }

  function applyContextMenuTargetSelection() {
    const targetItem = contextMenuTargetItem();
    if (!targetItem) return state.selectedIds.length > 0;
    setSingleSelection(targetItem.id);
    contextMenuState = null;
    return true;
  }

  function bringSelectionForward() {
    const item = selectedItem();
    if (!item) return;
    moveItemInZOrder(item.id, 1);
    render();
  }

  function sendSelectionBackward() {
    const item = selectedItem();
    if (!item) return;
    moveItemInZOrder(item.id, -1);
    render();
  }

  function moveItemInZOrder(itemId, direction) {
    const orderedItems = state.items.slice().sort((a, b) => a.zIndex - b.zIndex);
    const index = orderedItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;

    const targetIndex = clamp(index + direction, 0, orderedItems.length - 1);
    if (targetIndex === index) return;

    const [movedItem] = orderedItems.splice(index, 1);
    orderedItems.splice(targetIndex, 0, movedItem);
    orderedItems.forEach((item, orderedIndex) => {
      item.zIndex = orderedIndex;
    });
  }

  function deleteSelection() {
    if (state.selectedIds.length === 0) return;
    const selectedSet = new Set(state.selectedIds);
    state.items = state.items.filter((item) => !selectedSet.has(item.id));
    clearSelection();
    normalizeZOrder();
    closeContextMenu();
    render();
  }

  function toggleCropModeForSelection() {
    if (!isSingleSelection()) return;
    if (state.sliceMode) {
      exitSliceMode();
    }
    if (state.lineCutMode) {
      exitLineCutMode();
    }
    state.cropMode = !state.cropMode;
    render();
  }

  function enterLineCutMode() {
    if (!canLineCutSelectedItem()) return;
    state.cropMode = false;
    state.sliceMode = false;
    state.sliceDraft = null;
    state.lineCutMode = true;
    state.lineCutDraft = {
      itemId: state.activeSelection,
      orientation: "vertical",
      offset: null,
      placed: false,
      isDragging: false,
      preview: buildAxisAlignedLineCutPreview(selectedItem(), "vertical", null)
    };
  }

  function exitLineCutMode() {
    state.lineCutMode = false;
    state.lineCutDraft = null;
  }

  function enterSliceMode() {
    if (!canSliceSelectedItem()) return;
    state.cropMode = false;
    state.lineCutMode = false;
    state.lineCutDraft = null;
    state.sliceMode = true;
    state.sliceDraft = {
      itemId: state.activeSelection,
      mode: "grid",
      grid: { rows: 1, cols: 1 },
      guides: { vertical: [], horizontal: [] },
      pendingGuideAxis: null,
      previewRects: buildGridSliceRects()
    };
  }

  function exitSliceMode() {
    state.sliceMode = false;
    state.sliceDraft = null;
  }

  function updateSelectedNumeric(key, rawValue, minValue) {
    const item = selectedItem();
    if (!item) return;

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    item[key] = typeof minValue === "number" ? Math.max(minValue, parsed) : parsed;
    renderCanvas();
    renderAssets();
  }

  function updateSelectedCrop(key, rawValue, minValue) {
    const item = selectedItem();
    if (!item) return;

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const maxValue =
      key === "x" || key === "width" ? item.naturalWidth : item.naturalHeight;

    item.crop[key] = typeof minValue === "number" ? Math.max(minValue, parsed) : Math.max(0, parsed);
    item.crop.x = Math.min(item.crop.x, item.naturalWidth - 1);
    item.crop.y = Math.min(item.crop.y, item.naturalHeight - 1);
    item.crop.width = Math.min(item.crop.width, item.naturalWidth - item.crop.x);
    item.crop.height = Math.min(item.crop.height, item.naturalHeight - item.crop.y);
    item.crop[key] = Math.min(item.crop[key], maxValue);

    renderCanvas();
    updateInspector();
  }

  function selectedItem() {
    if (!isSingleSelection()) return null;
    return state.items.find((item) => item.id === state.activeSelection) || null;
  }

  function selectedItems() {
    const selectedSet = new Set(state.selectedIds);
    return state.items.filter((item) => selectedSet.has(item.id));
  }

  function currentSelectionIds() {
    return state.marqueeSelection ? state.marqueeSelection.hitIds : state.selectedIds;
  }

  function currentSelectionAssetIds() {
    const selectedSet = new Set(currentSelectionIds());
    return Array.from(new Set(
      state.items
        .filter((item) => selectedSet.has(item.id))
        .map((item) => item.assetId)
    ));
  }

  function isSingleSelection() {
    return state.selectedIds.length === 1 && typeof state.activeSelection === "string";
  }

  function isSelected(itemId) {
    return state.selectedIds.includes(itemId);
  }

  function setSingleSelection(itemId) {
    setSelection(itemId ? [itemId] : [], itemId);
  }

  function setSelection(itemIds, activeId) {
    const validIds = itemIds.filter((itemId) => state.items.some((item) => item.id === itemId));
    state.selectedIds = Array.from(new Set(validIds));
    state.activeSelection = state.selectedIds.includes(activeId)
      ? activeId
      : (state.selectedIds[state.selectedIds.length - 1] || null);
    if (!isSingleSelection()) {
      state.cropMode = false;
      state.sliceMode = false;
      state.sliceDraft = null;
      state.lineCutMode = false;
      state.lineCutDraft = null;
    }
  }

  function clearSelection() {
    state.selectedIds = [];
    state.activeSelection = null;
    state.cropMode = false;
    state.sliceMode = false;
    state.sliceDraft = null;
    state.lineCutMode = false;
    state.lineCutDraft = null;
  }

  function captureItemOrigins(itemIds) {
    const origins = {};
    itemsByIds(itemIds).forEach((item) => {
      origins[item.id] = { x: item.x, y: item.y };
    });
    return origins;
  }

  function moveSelectedItems(itemIds, origins, offsetX, offsetY) {
    itemsByIds(itemIds).forEach((item) => {
      const origin = origins[item.id];
      if (!origin) return;
      item.x = origin.x + offsetX;
      item.y = origin.y + offsetY;
    });
  }

  function itemsByIds(itemIds) {
    const selectedSet = new Set(itemIds);
    return state.items.filter((item) => selectedSet.has(item.id));
  }

  function visibleCanvasItems() {
    return state.items.filter((item) => !item.assetOnly);
  }

  function createCanvasItemFromAsset(asset, index) {
    const placement = resolveInitialPlacement(asset, index);
    return {
      id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      assetId: asset.id,
      name: asset.name,
      src: asset.src,
      naturalWidth: asset.naturalWidth,
      naturalHeight: asset.naturalHeight,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotation: 0,
      zIndex: state.items.length,
      crop: { x: 0, y: 0, width: asset.naturalWidth, height: asset.naturalHeight }
    };
  }

  function normalizeZOrder() {
    state.items
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((item, index) => {
        item.zIndex = index;
      });
  }

  async function exportSelectedAsMergedImage() {
    const items = selectedItems().slice().sort((a, b) => a.zIndex - b.zIndex);
    if (items.length === 0) return;

    const layout = buildExportLayout(items);
    if (!layout) return;

    await exportItemsWithLayout(layout, `camwheel-selection.${state.exportFormat}`);
  }

  async function exportSelectedAsSeparateImages() {
    const items = selectedItems().slice().sort((a, b) => a.zIndex - b.zIndex);
    if (items.length === 0) return;

    for (const [index, item] of items.entries()) {
      const layout = buildSingleItemExportLayout(item);
      if (!layout) continue;
      await exportItemsWithLayout(layout, buildIndividualExportFileName(item, index));
    }
  }

  async function exportItemsWithLayout(layout, fileName) {
    if (!layout) return;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(layout.width));
    canvas.height = Math.max(1, Math.ceil(layout.height));
    const context = canvas.getContext("2d");

    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const frame of layout.frames) {
      const image = await loadImage(frame.src);
      drawPolygonFrameToCanvas(context, image, frame);
    }

    const mime = state.exportFormat === "png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.98);
    triggerDownload(dataUrl, fileName);
  }

  function buildExportLayout(items) {
    const sortedItems = (items || []).slice().sort((a, b) => a.zIndex - b.zIndex);
    if (sortedItems.length === 0) return null;

    return buildOriginalSizeExportLayout(sortedItems);
  }

  function buildSingleItemExportLayout(item) {
    if (!item) return null;
    return buildOriginalSizeExportLayout([item]);
  }

  function buildGridSliceRects() {
    const item = selectedSliceSourceItem();
    if (!item) return [];

    const grid = normalizeSliceGrid(state.sliceDraft ? state.sliceDraft.grid : {
      rows: refs.fields.sliceRows.value,
      cols: refs.fields.sliceCols.value
    });
    const baseRect = resolveSliceBaseRect(item);
    const rects = [];
    const columnBase = Math.floor(baseRect.width / grid.cols);
    const rowBase = Math.floor(baseRect.height / grid.rows);
    let offsetY = 0;

    for (let row = 0; row < grid.rows; row += 1) {
      const rectHeight = row === grid.rows - 1 ? baseRect.height - offsetY : rowBase;
      let offsetX = 0;

      for (let col = 0; col < grid.cols; col += 1) {
        const rectWidth = col === grid.cols - 1 ? baseRect.width - offsetX : columnBase;
        rects.push({
          x: offsetX,
          y: offsetY,
          width: rectWidth,
          height: rectHeight
        });
        offsetX += rectWidth;
      }

      offsetY += rectHeight;
    }

    return rects.filter((rect) => rect.width > 0 && rect.height > 0);
  }

  function buildGuideSliceRects() {
    const item = selectedSliceSourceItem();
    if (!item || !state.sliceDraft) return [];

    const baseRect = resolveSliceBaseRect(item);
    const vertical = normalizeGuidePositions(
      state.sliceDraft.guides.vertical,
      baseRect.width
    );
    const horizontal = normalizeGuidePositions(
      state.sliceDraft.guides.horizontal,
      baseRect.height
    );
    const xBoundaries = [0, ...vertical, baseRect.width];
    const yBoundaries = [0, ...horizontal, baseRect.height];
    const rects = [];

    for (let row = 0; row < yBoundaries.length - 1; row += 1) {
      for (let col = 0; col < xBoundaries.length - 1; col += 1) {
        const rect = {
          x: xBoundaries[col],
          y: yBoundaries[row],
          width: xBoundaries[col + 1] - xBoundaries[col],
          height: yBoundaries[row + 1] - yBoundaries[row]
        };
        if (rect.width > 0 && rect.height > 0) {
          rects.push(rect);
        }
      }
    }

    return rects;
  }

  function createSliceItems() {
    const item = selectedSliceSourceItem();
    if (!item || !state.sliceDraft) return [];

    const scaleX = item.width / Math.max(item.crop.width, 1);
    const scaleY = item.height / Math.max(item.crop.height, 1);

    return state.sliceDraft.previewRects.map((rect, index) => ({
      id: `item-${Date.now()}-slice-${index}-${Math.random().toString(36).slice(2, 7)}`,
      assetId: item.assetId,
      name: item.name,
      src: item.src,
      naturalWidth: item.naturalWidth,
      naturalHeight: item.naturalHeight,
      x: item.x + rect.x * scaleX,
      y: item.y + rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
      rotation: item.rotation,
      zIndex: item.zIndex + index,
      crop: {
        x: item.crop.x + rect.x,
        y: item.crop.y + rect.y,
        width: rect.width,
        height: rect.height
      }
    }));
  }

  function isPolygonImageItem(item) {
    return Boolean(item) && item.type === "polygon-image";
  }

  function computePolygonItemBounds(polygon) {
    if (!polygon || polygon.length === 0) return null;

    const xs = polygon.map((point) => point.x);
    const ys = polygon.map((point) => point.y);
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function createLineCutItems(sourceItem, preview) {
    if (!sourceItem || !preview || !preview.polygons) return [];

    const scaleX = sourceItem.width / Math.max(sourceItem.crop.width, 1);
    const scaleY = sourceItem.height / Math.max(sourceItem.crop.height, 1);

    return preview.polygons
      .map((polygon, index) => {
        const bounds = computePolygonItemBounds(polygon);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

        return {
          id: `item-${Date.now()}-line-cut-${index}-${Math.random().toString(36).slice(2, 7)}`,
          type: "polygon-image",
          sourceImageId: sourceItem.assetId || sourceItem.id,
          assetId: sourceItem.assetId,
          name: sourceItem.name,
          src: sourceItem.src,
          naturalWidth: sourceItem.naturalWidth,
          naturalHeight: sourceItem.naturalHeight,
          x: sourceItem.x + bounds.minX * scaleX,
          y: sourceItem.y + bounds.minY * scaleY,
          width: bounds.width * scaleX,
          height: bounds.height * scaleY,
          rotation: sourceItem.rotation,
          zIndex: sourceItem.zIndex + index,
          crop: {
            x: sourceItem.crop.x + bounds.minX,
            y: sourceItem.crop.y + bounds.minY,
            width: bounds.width,
            height: bounds.height
          },
          polygon: polygon.map((point) => ({
            x: point.x - bounds.minX,
            y: point.y - bounds.minY
          })),
          originalBounds: {
            x: sourceItem.crop.x + bounds.minX,
            y: sourceItem.crop.y + bounds.minY,
            width: bounds.width,
            height: bounds.height
          }
        };
      })
      .filter(Boolean);
  }

  function normalizeSliceGrid(grid) {
    return {
      rows: Math.max(1, Math.round(Number(grid.rows) || 1)),
      cols: Math.max(1, Math.round(Number(grid.cols) || 1))
    };
  }

  function resolveSliceBaseRect(item) {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, Math.round(item.crop.width)),
      height: Math.max(1, Math.round(item.crop.height))
    };
  }

  function updateSliceDraftFromGrid() {
    if (!state.sliceDraft) return;
    state.sliceDraft.grid = normalizeSliceGrid({
      rows: refs.fields.sliceRows.value,
      cols: refs.fields.sliceCols.value
    });
    state.sliceDraft.previewRects = buildGridSliceRects();
  }

  function updateSliceDraftFromGuides() {
    if (!state.sliceDraft) return;
    const item = selectedSliceSourceItem();
    if (!item) return;
    const baseRect = resolveSliceBaseRect(item);
    state.sliceDraft.guides = {
      vertical: normalizeGuidePositions(parseGuideList(refs.fields.sliceVerticalGuides.value), baseRect.width),
      horizontal: normalizeGuidePositions(parseGuideList(refs.fields.sliceHorizontalGuides.value), baseRect.height)
    };
    state.sliceDraft.previewRects = buildGuideSliceRects();
    syncGuideInputs();
  }

  function requestSliceGuidePlacement(axis) {
    if (!state.sliceDraft) return;
    state.sliceDraft.mode = "guides";
    state.sliceDraft.pendingGuideAxis = axis === "horizontal" ? "horizontal" : "vertical";
    state.sliceDraft.previewRects = buildGuideSliceRects();
  }

  function addSliceGuide(axis, rawValue) {
    if (!state.sliceDraft) return;
    const item = selectedSliceSourceItem();
    if (!item) return;

    const baseRect = resolveSliceBaseRect(item);
    const guideAxis = axis === "horizontal" ? "horizontal" : "vertical";
    const maxValue = guideAxis === "vertical" ? baseRect.width : baseRect.height;
    state.sliceDraft.guides[guideAxis] = normalizeGuidePositions(
      state.sliceDraft.guides[guideAxis].concat([Math.round(rawValue)]),
      maxValue
    );
    state.sliceDraft.pendingGuideAxis = null;
    state.sliceDraft.previewRects = buildGuideSliceRects();
    syncGuideInputs();
  }

  function parseGuideList(rawValue) {
    return String(rawValue || "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));
  }

  function normalizeGuidePositions(values, maxValue) {
    return Array.from(
      new Set(
        (values || [])
          .map((value) => Math.round(value))
          .filter((value) => value > 0 && value < maxValue)
          .sort((a, b) => a - b)
      )
    );
  }

  function syncGuideInputs() {
    if (!state.sliceDraft) return;
    refs.fields.sliceVerticalGuides.value = state.sliceDraft.guides.vertical.join(",");
    refs.fields.sliceHorizontalGuides.value = state.sliceDraft.guides.horizontal.join(",");
  }

  function renderSlicePreview(item) {
    const overlay = document.createElement("div");
    overlay.className = "slice-preview-overlay";
    overlay.setAttribute("data-role", "slice-preview-overlay");
    overlay.classList.toggle("is-guides-mode", state.sliceDraft.mode === "guides");
    overlay.classList.toggle("is-pending-guide", Boolean(state.sliceDraft.pendingGuideAxis));
    overlay.addEventListener("pointerdown", (event) => {
      handleSlicePreviewPointerDown(event, item);
    });

    const count = document.createElement("div");
    count.className = "slice-preview-count";
    count.setAttribute("data-role", "slice-preview-count");
    count.textContent = `${state.sliceDraft.previewRects.length} 片`;
    overlay.appendChild(count);

    const scaleX = item.width / Math.max(item.crop.width, 1);
    const scaleY = item.height / Math.max(item.crop.height, 1);

    state.sliceDraft.previewRects.forEach((rect) => {
      const box = document.createElement("div");
      box.className = "slice-preview-box";
      box.style.left = `${rect.x * scaleX}px`;
      box.style.top = `${rect.y * scaleY}px`;
      box.style.width = `${rect.width * scaleX}px`;
      box.style.height = `${rect.height * scaleY}px`;
      overlay.appendChild(box);
    });

    if (state.sliceDraft.mode === "guides") {
      state.sliceDraft.guides.vertical.forEach((value, index) => {
        const line = document.createElement("div");
        line.className = "slice-guide is-vertical";
        line.style.left = `${value * scaleX}px`;
        overlay.appendChild(line);

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "slice-guide-handle is-vertical";
        handle.style.left = `${value * scaleX}px`;
        handle.addEventListener("pointerdown", (event) => {
          startGuideDrag(event, item, "vertical", index);
        });
        overlay.appendChild(handle);
      });

      state.sliceDraft.guides.horizontal.forEach((value, index) => {
        const line = document.createElement("div");
        line.className = "slice-guide is-horizontal";
        line.style.top = `${value * scaleY}px`;
        overlay.appendChild(line);

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "slice-guide-handle is-horizontal";
        handle.style.top = `${value * scaleY}px`;
        handle.addEventListener("pointerdown", (event) => {
          startGuideDrag(event, item, "horizontal", index);
        });
        overlay.appendChild(handle);
      });
    }

    return overlay;
  }

  function handleSlicePreviewPointerDown(event, item) {
    if (!state.sliceDraft || state.sliceDraft.mode !== "guides") return;
    if (event.button === 1) return;
    if (event.target.closest(".slice-guide-handle")) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.button !== 0 || !state.sliceDraft.pendingGuideAxis) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = pointerToLocal(event, rect);
    const baseRect = resolveSliceBaseRect(item);
    const rawValue = state.sliceDraft.pendingGuideAxis === "vertical"
      ? pointer.x * baseRect.width
      : pointer.y * baseRect.height;

    addSliceGuide(state.sliceDraft.pendingGuideAxis, rawValue);
    render();
  }

  function startGuideDrag(event, item, axis, guideIndex) {
    if (!state.sliceDraft) return;
    event.preventDefault();
    event.stopPropagation();

    const node = event.currentTarget.closest(".canvas-item");
    if (!node) return;

    guideDragState = {
      pointerId: event.pointerId,
      itemId: item.id,
      axis,
      guideIndex,
      rect: node.getBoundingClientRect()
    };
    state.sliceDraft.pendingGuideAxis = null;

    window.addEventListener("pointermove", handleGuideDragMove);
    window.addEventListener("pointerup", handleGuideDragEnd);
    window.addEventListener("pointercancel", handleGuideDragEnd);
  }

  function handleGuideDragMove(event) {
    if (!guideDragState || guideDragState.pointerId !== event.pointerId) return;

    const item = state.items.find((entry) => entry.id === guideDragState.itemId);
    if (!item || !state.sliceDraft) return;

    const baseRect = resolveSliceBaseRect(item);
    const isVertical = guideDragState.axis === "vertical";
    const maxValue = isVertical ? baseRect.width : baseRect.height;
    const rawValue = isVertical
      ? ((event.clientX - guideDragState.rect.left) / Math.max(guideDragState.rect.width, 1)) * baseRect.width
      : ((event.clientY - guideDragState.rect.top) / Math.max(guideDragState.rect.height, 1)) * baseRect.height;
    const roundedValue = Math.round(rawValue);
    const guides = state.sliceDraft.guides[guideDragState.axis].slice();
    guides[guideDragState.guideIndex] = roundedValue;
    const normalized = normalizeGuidePositions(guides, maxValue);
    state.sliceDraft.guides[guideDragState.axis] = normalized;
    state.sliceDraft.previewRects = buildGuideSliceRects();
    syncGuideInputs();

    const clamped = Math.max(1, Math.min(maxValue - 1, roundedValue));
    const nextIndex = normalized.indexOf(clamped);
    if (nextIndex >= 0) {
      guideDragState.guideIndex = nextIndex;
    }

    render();
  }

  function handleGuideDragEnd(event) {
    if (!guideDragState || guideDragState.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", handleGuideDragMove);
    window.removeEventListener("pointerup", handleGuideDragEnd);
    window.removeEventListener("pointercancel", handleGuideDragEnd);
    guideDragState = null;
  }

  function sliceSourceItem() {
    if (!state.sliceDraft) return null;
    return state.items.find((item) => item.id === state.sliceDraft.itemId) || null;
  }

  function selectedSliceSourceItem() {
    return sliceSourceItem() || selectedItem();
  }

  function clearSliceGuides(axis) {
    if (!state.sliceDraft) return;
    if (axis === "vertical" || axis === "horizontal") {
      state.sliceDraft.guides[axis] = [];
    }
    state.sliceDraft.pendingGuideAxis = null;
    syncGuideInputs();
    state.sliceDraft.previewRects = buildGuideSliceRects();
  }

  function removeItemById(itemId) {
    state.items = state.items.filter((item) => item.id !== itemId);
  }

  function replaceItemWithSlices(sourceItem, slices) {
    if (!sourceItem || slices.length === 0) return;
    removeItemById(sourceItem.id);
    state.items.push(...slices);
    normalizeZOrder();
    setSelection(slices.map((item) => item.id), slices[slices.length - 1].id);
  }

  function replaceItemWithLineCutPieces(sourceItem, pieces) {
    if (!sourceItem || pieces.length === 0) return;
    removeItemById(sourceItem.id);
    state.items.push(...pieces);
    normalizeZOrder();
    setSelection(pieces.map((item) => item.id), pieces[pieces.length - 1].id);
  }

  function confirmSlice() {
    const sourceItem = selectedSliceSourceItem();
    if (!sourceItem || !state.sliceDraft || !canConfirmSlice()) return;

    const slices = createSliceItems();
    replaceItemWithSlices(sourceItem, slices);
    closeContextMenu();
    exitSliceMode();
    showNotice(`切片已完成，共生成 ${slices.length} 片`);
  }

  function cancelSlice() {
    closeContextMenu();
    exitSliceMode();
  }

  function confirmLineCut() {
    const sourceItem = selectedItem();
    if (!sourceItem || !state.lineCutDraft || !canConfirmLineCut()) return;

    const pieces = createLineCutItems(sourceItem, state.lineCutDraft.preview);
    replaceItemWithLineCutPieces(sourceItem, pieces);
    closeContextMenu();
    exitLineCutMode();
  }

  function cancelLineCut() {
    closeContextMenu();
    exitLineCutMode();
  }

  function computeSelectedBounds() {
    return computeBoundsForItems(selectedItems());
  }

  function clientPointToWorld(clientX, clientY) {
    const surfaceRect = refs.canvasSurface.getBoundingClientRect();
    return {
      x: (clientX - surfaceRect.left - state.viewport.x) / state.viewport.zoom,
      y: (clientY - surfaceRect.top - state.viewport.y) / state.viewport.zoom
    };
  }

  function worldPointToClient(point) {
    const surfaceRect = refs.canvasSurface.getBoundingClientRect();
    return {
      x: surfaceRect.left + state.viewport.x + point.x * state.viewport.zoom,
      y: surfaceRect.top + state.viewport.y + point.y * state.viewport.zoom
    };
  }

  function resolveZoomAnchorWorldPoint(clientX, clientY) {
    const bounds = computeSelectedBounds();
    if (bounds) {
      return {
        x: bounds.minX + bounds.width / 2,
        y: bounds.minY + bounds.height / 2
      };
    }
    return clientPointToWorld(clientX, clientY);
  }

  function zoomViewportAt(clientX, clientY, nextZoom) {
    const clampedZoom = Math.min(3, Math.max(0.2, nextZoom));
    const anchorWorld = resolveZoomAnchorWorldPoint(clientX, clientY);
    const anchorClient = computeSelectedBounds()
      ? worldPointToClient(anchorWorld)
      : { x: clientX, y: clientY };
    const surfaceRect = refs.canvasSurface.getBoundingClientRect();

    state.viewport.zoom = clampedZoom;
    state.viewport.x = anchorClient.x - surfaceRect.left - anchorWorld.x * clampedZoom;
    state.viewport.y = anchorClient.y - surfaceRect.top - anchorWorld.y * clampedZoom;
    renderCanvas();
  }

  function computeBoundsForItems(items) {
    if (!items || items.length === 0) return null;

    const xs = [];
    const ys = [];
    items.forEach((item) => {
      xs.push(item.x, item.x + item.width);
      ys.push(item.y, item.y + item.height);
    });

    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);

    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  function buildOriginalSizeExportLayout(items) {
    const bounds = computeBoundsForItems(items);
    if (!bounds) return null;

    const positionScale = resolveOriginalSizePositionScale(items);
    const frames = items.map((item) => createOriginalSizeFrame(item, bounds, positionScale));
    return finalizeExportLayout(frames);
  }

  function createOriginalSizeFrame(item, bounds, positionScale) {
    if (isPolygonImageItem(item)) {
      return createPolygonOriginalSizeFrame(item, bounds, positionScale);
    }
    return createExportFrame(
      item,
      bounds,
      positionScale.x,
      positionScale.y,
      item.crop.width,
      item.crop.height
    );
  }

  function createScaledExportFrame(item, bounds, scaleFactor) {
    return createExportFrame(
      item,
      bounds,
      scaleFactor,
      scaleFactor,
      item.width * scaleFactor,
      item.height * scaleFactor
    );
  }

  function createExportFrame(item, bounds, positionScaleX, positionScaleY, frameWidth, frameHeight) {
    const centerX = (item.x - bounds.minX + item.width / 2) * positionScaleX;
    const centerY = (item.y - bounds.minY + item.height / 2) * positionScaleY;
    const polygon = isPolygonImageItem(item)
      ? item.polygon.map((point) => ({
        x: point.x * (frameWidth / Math.max(item.crop.width, 1)),
        y: point.y * (frameHeight / Math.max(item.crop.height, 1))
      }))
      : null;

    return {
      id: item.id,
      src: item.src,
      type: item.type || "image",
      rotation: item.rotation,
      crop: { ...item.crop },
      polygon,
      x: centerX - frameWidth / 2,
      y: centerY - frameHeight / 2,
      width: frameWidth,
      height: frameHeight
    };
  }

  function createPolygonOriginalSizeFrame(item, bounds, positionScale) {
    return createExportFrame(
      item,
      bounds,
      positionScale.x,
      positionScale.y,
      item.crop.width,
      item.crop.height
    );
  }

  function buildPolygonExportLayout(items, bounds, scaleFactor) {
    return items.map((item) => createScaledExportFrame(item, bounds, scaleFactor));
  }

  function resolveOriginalSizePositionScale(items) {
    const totalDisplayWidth = items.reduce((sum, item) => sum + Math.max(item.width, 1), 0);
    const totalDisplayHeight = items.reduce((sum, item) => sum + Math.max(item.height, 1), 0);
    const totalCropWidth = items.reduce((sum, item) => sum + Math.max(item.crop.width, 1), 0);
    const totalCropHeight = items.reduce((sum, item) => sum + Math.max(item.crop.height, 1), 0);

    return {
      x: totalCropWidth / Math.max(totalDisplayWidth, 1),
      y: totalCropHeight / Math.max(totalDisplayHeight, 1)
    };
  }

  function finalizeExportLayout(frames) {
    const bounds = computeFrameBounds(frames);
    if (!bounds) return null;

    return {
      width: bounds.width,
      height: bounds.height,
      frames: frames.map((frame) => ({
        ...frame,
        x: frame.x - bounds.minX,
        y: frame.y - bounds.minY
      }))
    };
  }

  function computeFrameBounds(frames) {
    if (!frames || frames.length === 0) return null;

    const xs = [];
    const ys = [];

    frames.forEach((frame) => {
      xs.push(frame.x, frame.x + frame.width);
      ys.push(frame.y, frame.y + frame.height);
    });

    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function buildIndividualExportFileName(item, index) {
    const stem = sanitizeExportFileStem(item && item.name ? item.name : "camwheel-item");
    const serial = String(index + 1).padStart(2, "0");
    return `${stem}-${serial}.${state.exportFormat}`;
  }

  function sanitizeExportFileStem(name) {
    return String(name || "camwheel-item")
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "camwheel-item";
  }

  function triggerDownload(dataUrl, fileName) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function renderPolygonItem(node, item) {
    const image = document.createElement("img");
    image.src = item.src;
    image.alt = item.name;
    applyCropStyle(image, item, false);
    image.style.clipPath = polygonToClipPath(
      item.polygon || [],
      Math.max(item.crop.width, 1),
      Math.max(item.crop.height, 1)
    );
    node.appendChild(image);
  }

  function drawPolygonFrameToCanvas(context, image, frame) {
    context.save();
    context.translate(frame.x + frame.width / 2, frame.y + frame.height / 2);
    context.rotate((frame.rotation * Math.PI) / 180);
    if (frame.polygon && frame.polygon.length >= 3) {
      context.beginPath();
      frame.polygon.forEach((point, index) => {
        const pointX = point.x - frame.width / 2;
        const pointY = point.y - frame.height / 2;
        if (index === 0) {
          context.moveTo(pointX, pointY);
        } else {
          context.lineTo(pointX, pointY);
        }
      });
      context.closePath();
      context.clip();
    }
    context.drawImage(
      image,
      frame.crop.x,
      frame.crop.y,
      frame.crop.width,
      frame.crop.height,
      -frame.width / 2,
      -frame.height / 2,
      frame.width,
      frame.height
    );
    context.restore();
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function applyCropStyle(image, item, cropModeActive) {
    const sourceWidth = cropModeActive ? item.naturalWidth : item.crop.width;
    const sourceHeight = cropModeActive ? item.naturalHeight : item.crop.height;
    const scaleX = item.width / sourceWidth;
    const scaleY = item.height / sourceHeight;
    image.style.width = `${item.naturalWidth * scaleX}px`;
    image.style.height = `${item.naturalHeight * scaleY}px`;
    const offsetX = cropModeActive ? 0 : item.crop.x;
    const offsetY = cropModeActive ? 0 : item.crop.y;
    image.style.transform = `translate(${-offsetX * scaleX}px, ${-offsetY * scaleY}px)`;
    image.style.transformOrigin = "top left";
    image.style.maxWidth = "none";
    image.style.maxHeight = "none";
  }

  function buildCropOverlay(item) {
    const overlay = document.createElement("div");
    overlay.className = "crop-overlay";
    overlay.dataset.role = "crop-overlay";

    const box = document.createElement("div");
    box.className = "crop-box";
    box.style.left = `${(item.crop.x / item.naturalWidth) * 100}%`;
    box.style.top = `${(item.crop.y / item.naturalHeight) * 100}%`;
    box.style.width = `${(item.crop.width / item.naturalWidth) * 100}%`;
    box.style.height = `${(item.crop.height / item.naturalHeight) * 100}%`;
    overlay.appendChild(box);
    return overlay;
  }

  function renderSnapGuides() {
    if (typeof state.snapGuides.x === "number") {
      const verticalGuide = document.createElement("div");
      verticalGuide.className = "snap-guide is-vertical";
      verticalGuide.style.left = `${state.snapGuides.x}px`;
      refs.canvasItems.appendChild(verticalGuide);
    }

    if (typeof state.snapGuides.y === "number") {
      const horizontalGuide = document.createElement("div");
      horizontalGuide.className = "snap-guide is-horizontal";
      horizontalGuide.style.top = `${state.snapGuides.y}px`;
      refs.canvasItems.appendChild(horizontalGuide);
    }
  }

  function renderMarqueeSelection() {
    if (!state.marqueeSelection) return;
    const rect = marqueeSurfaceRect(state.marqueeSelection);
    const marquee = document.createElement("div");
    marquee.className = "selection-marquee";
    marquee.style.left = `${rect.left}px`;
    marquee.style.top = `${rect.top}px`;
    marquee.style.width = `${rect.width}px`;
    marquee.style.height = `${rect.height}px`;
    refs.selectionOverlay.appendChild(marquee);
  }

  function renderExportSelectionBounds() {
    const bounds = computeSelectedBounds();
    if (!bounds || state.marqueeSelection) return;

    const box = document.createElement("div");
    box.className = "export-selection-bounds";
    box.setAttribute("data-role", "export-selection-bounds");
    box.style.left = `${state.viewport.x + bounds.minX * state.viewport.zoom}px`;
    box.style.top = `${state.viewport.y + bounds.minY * state.viewport.zoom}px`;
    box.style.width = `${bounds.width * state.viewport.zoom}px`;
    box.style.height = `${bounds.height * state.viewport.zoom}px`;
    refs.selectionOverlay.appendChild(box);
  }

  function computeMarqueeSelectionIds(selection) {
    const marqueeRect = marqueeWorldRect(selection);
    return state.items
      .filter((item) => rectsIntersect(marqueeRect, {
        minX: item.x,
        minY: item.y,
        maxX: item.x + item.width,
        maxY: item.y + item.height
      }))
      .map((item) => item.id);
  }

  function marqueeClientRect(selection) {
    return {
      left: Math.min(selection.startClientX, selection.currentClientX),
      top: Math.min(selection.startClientY, selection.currentClientY),
      width: Math.abs(selection.currentClientX - selection.startClientX),
      height: Math.abs(selection.currentClientY - selection.startClientY)
    };
  }

  function marqueeSurfaceRect(selection) {
    const rect = marqueeClientRect(selection);
    const surfaceRect = refs.canvasSurface.getBoundingClientRect();
    return {
      left: rect.left - surfaceRect.left,
      top: rect.top - surfaceRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function marqueeWorldRect(selection) {
    const rect = marqueeClientRect(selection);
    const surfaceRect = refs.canvasSurface.getBoundingClientRect();
    const zoom = state.viewport.zoom;

    return {
      minX: (rect.left - surfaceRect.left - state.viewport.x) / zoom,
      minY: (rect.top - surfaceRect.top - state.viewport.y) / zoom,
      maxX: (rect.left + rect.width - surfaceRect.left - state.viewport.x) / zoom,
      maxY: (rect.top + rect.height - surfaceRect.top - state.viewport.y) / zoom
    };
  }

  function rectsIntersect(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }

  function pointerToLocal(event, rect) {
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    };
  }

  function normalizeCropRect(start, end, originCrop, item) {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);

    const cropX = originCrop.x + originCrop.width * minX;
    const cropY = originCrop.y + originCrop.height * minY;
    const cropWidth = Math.max(1, originCrop.width * (maxX - minX));
    const cropHeight = Math.max(1, originCrop.height * (maxY - minY));

    return {
      x: clamp(cropX, 0, item.naturalWidth - 1),
      y: clamp(cropY, 0, item.naturalHeight - 1),
      width: clamp(cropWidth, 1, item.naturalWidth - cropX),
      height: clamp(cropHeight, 1, item.naturalHeight - cropY)
    };
  }

  function applyDragSnapping(item, nextX, nextY, excludedIds) {
    const itemSnap = snapToItems(item, nextX, nextY, excludedIds);
    const snappedX = itemSnap.xSnapped ? { value: itemSnap.x, guide: itemSnap.xGuide } : snapToGrid(itemSnap.x);
    const snappedY = itemSnap.ySnapped ? { value: itemSnap.y, guide: itemSnap.yGuide } : snapToGrid(itemSnap.y);

    setSnapGuides({ x: snappedX.guide, y: snappedY.guide });

    return {
      x: snappedX.value,
      y: snappedY.value
    };
  }

  function snapToItems(item, nextX, nextY, excludedIds) {
    const currentXRefs = [nextX, nextX + item.width / 2, nextX + item.width];
    const currentYRefs = [nextY, nextY + item.height / 2, nextY + item.height];
    const excludedSet = new Set(excludedIds || []);
    let bestX = { delta: 0, distance: SNAP_THRESHOLD + 1, guide: null };
    let bestY = { delta: 0, distance: SNAP_THRESHOLD + 1, guide: null };

    state.items.forEach((candidate) => {
      if (excludedSet.has(candidate.id)) return;

      const candidateXRefs = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
      const candidateYRefs = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];

      currentXRefs.forEach((sourceX) => {
        candidateXRefs.forEach((targetX) => {
          const delta = targetX - sourceX;
          const distance = Math.abs(delta);
          if (distance <= SNAP_THRESHOLD && distance < bestX.distance) {
            bestX = { delta, distance, guide: targetX };
          }
        });
      });

      currentYRefs.forEach((sourceY) => {
        candidateYRefs.forEach((targetY) => {
          const delta = targetY - sourceY;
          const distance = Math.abs(delta);
          if (distance <= SNAP_THRESHOLD && distance < bestY.distance) {
            bestY = { delta, distance, guide: targetY };
          }
        });
      });
    });

    return {
      x: nextX + bestX.delta,
      y: nextY + bestY.delta,
      xSnapped: bestX.distance <= SNAP_THRESHOLD,
      ySnapped: bestY.distance <= SNAP_THRESHOLD,
      xGuide: bestX.guide,
      yGuide: bestY.guide
    };
  }

  function snapToGrid(value) {
    const snapped = Math.round(value / GRID_SIZE) * GRID_SIZE;
    return Math.abs(snapped - value) <= SNAP_THRESHOLD
      ? { value: snapped, guide: snapped }
      : { value, guide: null };
  }

  function setSnapGuides(guides) {
    state.snapGuides = {
      x: typeof guides.x === "number" ? guides.x : null,
      y: typeof guides.y === "number" ? guides.y : null
    };
  }

  function clearSnapGuides() {
    setSnapGuides({ x: null, y: null });
  }

  function resolveInitialPlacement(image, index) {
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const maxDimension = Math.max(sourceWidth, sourceHeight);
    const scaledToMax = INITIAL_ITEM_MAX_SIZE / maxDimension;
    let scale = Math.min(INITIAL_ITEM_SCALE, scaledToMax);
    if (maxDimension * scale < INITIAL_ITEM_MIN_SIZE) {
      scale = INITIAL_ITEM_MIN_SIZE / maxDimension;
    }

    return {
      x: IMPORT_BASE_OFFSET + index * IMPORT_OFFSET_STEP,
      y: IMPORT_BASE_OFFSET + index * IMPORT_OFFSET_STEP,
      width: Math.round(sourceWidth * scale),
      height: Math.round(sourceHeight * scale)
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  window.CamWheelCanvasTool = {
    state,
    render,
    importFiles,
    selectedItems,
    computeSelectedBounds,
    exportSelectedAsMergedImage,
    exportSelectedAsSeparateImages,
    buildExportLayout,
    buildSingleItemExportLayout,
    buildOriginalSizeExportLayout,
    canLineCutSelectedItem,
    enterLineCutMode,
    exitLineCutMode,
    enterSliceMode,
    exitSliceMode,
    buildGridSliceRects,
    buildGuideSliceRects,
    createSliceItems,
    parseGuideList,
    normalizeGuidePositions,
    requestSliceGuidePlacement,
    addSliceGuide,
    selectedSliceSourceItem,
    confirmLineCut,
    cancelLineCut,
    confirmSlice,
    cancelSlice
  };

  init();
})();
