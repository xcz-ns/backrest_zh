import React, { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Form, Input, Modal, Space, Spin, Tree } from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import {
  ListSnapshotFilesResponse,
  ListSnapshotFilesResponseSchema,
  LsEntry,
  LsEntrySchema,
  RestoreSnapshotRequest,
  RestoreSnapshotRequestSchema,
} from "../../gen/ts/v1/service_pb";
import { useAlertApi } from "./Alerts";
import {
  DownloadOutlined,
  FileOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import { useShowModal } from "./ModalManager";
import { formatBytes, normalizeSnapshotId } from "../lib/formatting";
import { URIAutocomplete } from "./URIAutocomplete";
import { validateForm } from "../lib/formutil";
import { backrestService } from "../api";
import { ConfirmButton } from "./SpinButton";
import { StringValueSchema } from "../../gen/ts/types/value_pb";
import { pathSeparator } from "../state/buildcfg";
import { create, toJsonString } from "@bufbuild/protobuf";

const SnapshotBrowserContext = React.createContext<{
  snapshotId: string;
  planId?: string;
  repoId: string;
  showModal: (modal: React.ReactNode) => void; // slight performance hack.
} | null>(null);

// replaceKeyInTree returns a value only if changes are made.
const replaceKeyInTree = (
  curNode: DataNode,
  setKey: string,
  setValue: DataNode
): DataNode | null => {
  if (curNode.key === setKey) {
    return setValue;
  }
  if (!curNode.children || setKey.indexOf(curNode.key as string) === -1) {
    return null;
  }
  for (const idx in curNode.children!) {
    const child = curNode.children![idx];
    const newChild = replaceKeyInTree(child, setKey, setValue);
    if (newChild) {
      const curNodeCopy = { ...curNode };
      curNodeCopy.children = [...curNode.children!];
      curNodeCopy.children[idx] = newChild;
      return curNodeCopy;
    }
  }
  return null;
};

const findInTree = (curNode: DataNode, key: string): DataNode | null => {
  if (curNode.key === key) {
    return curNode;
  }
  if (!curNode.children || key.indexOf(curNode.key as string) === -1) {
    return null;
  }
  for (const child of curNode.children) {
    const found = findInTree(child, key);
    if (found) {
      return found;
    }
  }
  return null;
};

export const SnapshotBrowser = ({
  repoId,
  planId, // optional: purely to link restore operations to the right plan.
  snapshotId,
}: React.PropsWithoutRef<{
  snapshotId: string;
  repoId: string;
  planId?: string;
}>) => {
  const alertApi = useAlertApi();
  const showModal = useShowModal();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  
  useEffect(() => {
    setTreeData(
      respToNodes(
        create(ListSnapshotFilesResponseSchema, {
          entries: [
            {
              path: "/",
              type: "directory",
              name: "/",
            },
          ],
          path: "/",
        })
      )
    );
  }, [repoId, snapshotId]);

  const onLoadData = async ({ key, children }: EventDataNode<DataNode>) => {
    if (children) {
      return;
    }
    let path = key as string;
    if (!path.endsWith("/")) {
      path += "/";
    }
    const resp = await backrestService.listSnapshotFiles({
      path,
      repoId,
      snapshotId,
    });
    setTreeData((treeData) => {
      let toUpdate: DataNode | null = null;
      for (const node of treeData) {
        toUpdate = findInTree(node, key as string);
        if (toUpdate) {
          break;
        }
      }
      if (!toUpdate) {
        return treeData;
      }
      const toUpdateCopy = { ...toUpdate };
      toUpdateCopy.children = respToNodes(resp);
      return treeData.map((node) => {
        const didUpdate = replaceKeyInTree(node, key as string, toUpdateCopy);
        if (didUpdate) {
          return didUpdate;
        }
        return node;
      });
    });
  };

  return (
    <SnapshotBrowserContext.Provider
      value={{ snapshotId, repoId, planId, showModal }}
    >
      <Tree<DataNode> loadData={onLoadData} treeData={treeData} />
    </SnapshotBrowserContext.Provider>
  );
};

const respToNodes = (resp: ListSnapshotFilesResponse): DataNode[] => {
  const nodes = resp
    .entries!.filter((entry) => entry.path!.length >= resp.path!.length)
    .map((entry) => {
      const node: DataNode = {
        key: entry.path!,
        title: <FileNode entry={entry} />,
        isLeaf: entry.type === "file",
        icon: entry.type === "file" ? <FileOutlined /> : <FolderOutlined />,
      };
      return node;
    });
  return nodes;
};

const FileNode = ({ entry }: { entry: LsEntry }) => {
  const [dropdown, setDropdown] = useState<React.ReactNode>(null);
  const { snapshotId, repoId, planId, showModal } = React.useContext(
    SnapshotBrowserContext
  )!;

  const showDropdown = () => {
    setDropdown(
      <Dropdown
        menu={{
          items: [
            {
              key: "info",
              label: "详情",
              onClick: () => {
                showModal(
                  <Modal
                    title={"路径详情 " + entry.path}
                    open={true}
                    cancelButtonProps={{ style: { display: "none" } }}
                    onCancel={() => showModal(null)}
                    onOk={() => showModal(null)}
                  >
                    <pre>
                      {toJsonString(LsEntrySchema, entry, {
                        prettySpaces: 2,
                      })}
                    </pre>
                  </Modal>
                );
              },
            },
            {
              key: "restore",
              label: "恢复到指定路径",
              onClick: () => {
                showModal(
                  <RestoreModal
                    path={entry.path!}
                    repoId={repoId}
                    planId={planId}
                    snapshotId={snapshotId}
                  />
                );
              },
            },
          ],
        }}
      >
        <DownloadOutlined />
      </Dropdown>
    );
  };

  return (
    <Space onMouseEnter={showDropdown} onMouseLeave={() => setDropdown(null)}>
      {entry.name}
      {entry.type === "file" ? (
        <span className="backrest file-details">
          ({formatBytes(Number(entry.size))})
        </span>
      ) : null}
      {dropdown || <div style={{ width: 16 }}></div>}
    </Space>
  );
};

const RestoreModal = ({
  repoId,
  planId,
  snapshotId,
  path,
}: {
  repoId: string;
  planId?: string; // optional: purely to link restore operations to the right plan.
  snapshotId: string;
  path: string;
}) => {
  const [form] = Form.useForm<RestoreSnapshotRequest>();
  const showModal = useShowModal();
  const defaultPath = useMemo(() => {
    if (path === pathSeparator) {
      return "";
    }
    return path + "-backrest-恢复-" + normalizeSnapshotId(snapshotId);
  }, [path]);

  useEffect(() => {
    form.setFieldsValue({ target: defaultPath });
  }, [defaultPath]);

  const handleCancel = () => {
    showModal(null);
  };

  const handleOk = async () => {
    try {
      const values = await validateForm(form);
      await backrestService.restore(
        create(RestoreSnapshotRequestSchema, {
          repoId,
          planId,
          snapshotId,
          path,
          target: values.target,
        })
      );
    } catch (e: any) {
      alert("恢复快照失败: " + e.message);
    } finally {
      showModal(null); // close.
    }
  };

  let targetPath = Form.useWatch("target", form);
  useEffect(() => {
    if (!targetPath) {
      return;
    }
    (async () => {
      try {
        let p = targetPath;
        if (p.endsWith(pathSeparator)) {
          p = p.slice(0, -1);
        }
        const dirname = basename(p);
        const files = await backrestService.pathAutocomplete(
          create(StringValueSchema, { value: dirname })
        );
        for (const file of files.values) {
          if (dirname + file === p) {
            form.setFields([
              {
                name: "target",
                errors: [
                  "目标路径已存在，请选择一个空路径。",
                ],
              },
            ]);
            return;
          }
        }
        form.setFields([
          {
            name: "target",
            value: targetPath,
            errors: [],
          },
        ]);
      } catch (e: any) {
        form.setFields([
          {
            name: "target",
            errors: [e.message],
          },
        ]);
      }
    })();
  }, [targetPath]);

  return (
    <Modal
      open={true}
      onCancel={handleCancel}
      title={
        "恢复 " + path + " 来自快照 " + normalizeSnapshotId(snapshotId)
      }
      width="40vw"
      footer={[
        <Button key="back" onClick={handleCancel}>
          取消
        </Button>,
        <ConfirmButton
          key="submit"
          type="primary"
          confirmTitle="确认恢复？"
          onClickAsync={handleOk}
        >
          立即恢复
        </ConfirmButton>,
      ]}
    >
      <Form
        autoComplete="off"
        form={form}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
      >
        <p>
          如果要恢复到特定路径，请确保该路径不存在或您愿意覆盖该位置的数据。
        </p>
        <p>
          您可以将路径设置为空字符串以恢复到下载目录。
        </p>
        <Form.Item label="恢复到路径" name="target" rules={[]}>
          <URIAutocomplete
            placeholder="恢复到下载目录"
            defaultValue={defaultPath}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const basename = (path: string) => {
  const idx = path.lastIndexOf(pathSeparator);
  if (idx === -1) {
    return path;
  }
  return path.slice(0, idx + 1);
};