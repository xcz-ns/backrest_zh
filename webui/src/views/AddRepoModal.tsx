import {
  Form,
  Modal,
  Input,
  Typography,
  AutoComplete,
  Tooltip,
  Button,
  Row,
  Col,
  Card,
  InputNumber,
  FormInstance,
  Collapse,
  Checkbox,
  Select,
  Space,
} from "antd";
import React, { useEffect, useState } from "react";
import { useShowModal } from "../components/ModalManager";
import {
  CommandPrefix_CPUNiceLevel,
  CommandPrefix_CPUNiceLevelSchema,
  CommandPrefix_IONiceLevel,
  CommandPrefix_IONiceLevelSchema,
  type Repo,
  RepoSchema,
  Schedule_Clock,
} from "../../gen/ts/v1/config_pb";
import { StringValueSchema } from "../../gen/ts/types/value_pb";
import { URIAutocomplete } from "../components/URIAutocomplete";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { namePattern, validateForm } from "../lib/formutil";
import { backrestService } from "../api";
import {
  HooksFormList,
  hooksListTooltipText,
} from "../components/HooksFormList";
import { ConfirmButton, SpinButton } from "../components/SpinButton";
import { useConfig } from "../components/ConfigProvider";
import Cron from "react-js-cron";
import {
  ScheduleDefaultsInfrequent,
  ScheduleFormItem,
} from "../components/ScheduleFormItem";
import { isWindows } from "../state/buildcfg";
import { create, fromJson, JsonValue, toJson } from "@bufbuild/protobuf";

const repoDefaults = create(RepoSchema, {
  prunePolicy: {
    maxUnusedPercent: 10,
    schedule: {
      schedule: {
        case: "cron",
        value: "0 0 1 * *", // 每月 1 号
      },
      clock: Schedule_Clock.LAST_RUN_TIME,
    },
  },
  checkPolicy: {
    schedule: {
      schedule: {
        case: "cron",
        value: "0 0 1 * *", // 每月 1 号
      },
      clock: Schedule_Clock.LAST_RUN_TIME,
    },
  },
  commandPrefix: {
    ioNice: CommandPrefix_IONiceLevel.IO_DEFAULT,
    cpuNice: CommandPrefix_CPUNiceLevel.CPU_DEFAULT,
  },
});

export const AddRepoModal = ({ template }: { template: Repo | null }) => {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;
  const [config, setConfig] = useConfig();
  const [form] = Form.useForm<JsonValue>();

  useEffect(() => {
    const initVal = template
      ? toJson(RepoSchema, template, {
          alwaysEmitImplicit: true,
        })
      : toJson(RepoSchema, repoDefaults, { alwaysEmitImplicit: true });
    form.setFieldsValue(initVal);
  }, [template]);

  if (!config) {
    return null;
  }

  const handleDestroy = async () => {
    setConfirmLoading(true);
    try {
      setConfig(
        await backrestService.removeRepo(
          create(StringValueSchema, { value: template!.id })
        )
      );
      showModal(null);
      alertsApi.success(
        "已从配置中删除存储库 " +
          template!.id! +
          "，但文件仍保留在磁盘上。如需释放空间，请手动删除文件。URI：" +
          template!.uri
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 15);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOk = async () => {
    setConfirmLoading(true);
    try {
      let repoFormData = await validateForm(form);
      const repo = fromJson(RepoSchema, repoFormData, {
        ignoreUnknownFields: false,
      });

      if (template !== null) {
        setConfig(await backrestService.addRepo(repo));
        showModal(null);
        alertsApi.success("已更新存储库配置：" + repo.uri);
      } else {
        setConfig(await backrestService.addRepo(repo));
        showModal(null);
        alertsApi.success("已添加存储库：" + repo.uri);
      }

      try {
        await backrestService.listSnapshots({ repoId: repo.id });
      } catch (e: any) {
        alertsApi.error(
          formatErrorAlert(e, "列出快照失败："),
          10
        );
      }
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 10);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = () => {
    showModal(null);
  };

  return (
    <>
      <Modal
        open={true}
        onCancel={handleCancel}
        title={template ? "编辑 Restic 存储库" : "添加 Restic 存储库"}
        width="60vw"
        footer={[
          <Button loading={confirmLoading} key="back" onClick={handleCancel}>
            取消
          </Button>,
          template != null ? (
            <Tooltip title="从配置中移除该存储库，但不会删除实际的 restic 存储库">
              <ConfirmButton
                key="delete"
                type="primary"
                danger
                onClickAsync={handleDestroy}
                confirmTitle="确认删除"
              >
                删除
              </ConfirmButton>
            </Tooltip>
          ) : null,
          <SpinButton
            key="check"
            onClickAsync={async () => {
              let repoFormData = await validateForm(form);
              const repo = fromJson(RepoSchema, repoFormData, {
                ignoreUnknownFields: false,
              });
              try {
                const exists = await backrestService.checkRepoExists(repo);
                if (exists.value) {
                  alertsApi.success(
                    "成功连接到 " +
                      repo.uri +
                      "，发现一个现有存储库。",
                    10
                  );
                } else {
                  alertsApi.success(
                    "成功连接到 " +
                      repo.uri +
                      "，未找到现有存储库，将初始化一个新的存储库。",
                    10
                  );
                }
              } catch (e: any) {
                alertsApi.error(formatErrorAlert(e, "测试失败："), 10);
              }
            }}
          >
            测试配置
          </SpinButton>,
          <Button
            key="submit"
            type="primary"
            loading={confirmLoading}
            onClick={handleOk}
          >
            提交
          </Button>,
        ]}
        maskClosable={false}
      >
        <p>
          如何配置存储库请参阅{" "}
          <a
            href="https://garethgeorge.github.io/backrest/introduction/getting-started" 
            target="_blank"
          >
            Backrest 入门指南
          </a>{" "}
          或查看{" "}
          <a href="https://restic.readthedocs.io/"  target="_blank">
            restic 官方文档
          </a>{" "}
          获取更多详情。
        </p>
        <br />
        <Form
          autoComplete="off"
          form={form}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 18 }}
          disabled={confirmLoading}
        >
          {/* Repo.id */}
          <Tooltip
            title={
              "用于标识此存储库在 Backrest 中的唯一 ID（例如 s3-mybucket）。创建后无法更改。"
            }
          >
            <Form.Item<Repo>
              hasFeedback
              name="id"
              label="存储库名称"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入存储库名称",
                },
                {
                  validator: async (_, value) => {
                    if (template) return;
                    if (config?.repos?.find((r) => r.id === value)) {
                      throw new Error("已存在相同名称的存储库");
                    }
                  },
                  message: "已存在相同名称的存储库",
                },
                {
                  pattern: namePattern,
                  message:
                    "名称必须为字母数字组合，允许使用横线或下划线作为分隔符",
                },
              ]}
            >
              <Input
                disabled={!!template}
                placeholder={"repo" + ((config?.repos?.length || 0) + 1)}
              />
            </Form.Item>
          </Tooltip>
          <Form.Item<Repo> name="guid" hidden>
            <Input />
          </Form.Item>

          {/* Repo.uri */}
          <Tooltip
            title={
              <>
                支持的存储库格式：
                <ul>
                  <li>本地路径</li>
                  <li>S3 示例：s3://...</li>
                  <li>SFTP 示例：sftp:user@host:/repo-path</li>
                  <li>
                    更多信息请参考{" "}
                    <a
                      href="https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html#preparing-a-new-repository" 
                      target="_blank"
                    >
                      restic 文档
                    </a>
                  </li>
                </ul>
              </>
            }
          >
            <Form.Item<Repo>
              hasFeedback
              name="uri"
              label="存储库地址"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入存储库地址",
                },
              ]}
            >
              <URIAutocomplete disabled={!!template} />
            </Form.Item>
          </Tooltip>

          {/* Repo.password */}
          <Tooltip
            title={
              <>
                此密码将用于加密存储库中的数据。
                <ul>
                  <li>建议选择至少 128 位熵值的密码（如长度大于等于 20）</li>
                  <li>也可以通过环境变量提供凭证，如 RESTIC_PASSWORD、RESTIC_PASSWORD_FILE、RESTIC_PASSWORD_COMMAND</li>
                  <li>点击 [生成] 按钮可基于浏览器的随机数生成器生成一个安全密码。</li>
                </ul>
              </>
            }
          >
            <Form.Item label="密码">
              <Row>
                <Col span={16}>
                  <Form.Item<Repo>
                    hasFeedback
                    name="password"
                    validateTrigger={["onChange", "onBlur"]}
                  >
                    <Input disabled={!!template} />
                  </Form.Item>
                </Col>
                <Col
                  span={7}
                  offset={1}
                  style={{ display: "flex", justifyContent: "left" }}
                >
                  <Button
                    type="text"
                    onClick={() => {
                      if (template) return;
                      form.setFieldsValue({
                        password: cryptoRandomPassword(),
                      });
                    }}
                  >
                    [生成]
                  </Button>
                </Col>
              </Row>
            </Form.Item>
          </Tooltip>

          {/* Repo.env */}
          <Tooltip
            title={
              "传递给 restic 的环境变量（例如 S3 或 B2 凭证）。支持引用父进程的环境变量，如 FOO=${MY_FOO_VAR}"
            }
          >
            <Form.Item label="环境变量">
              <Form.List
                name="env"
                rules={[
                  {
                    validator: async (_, envVars) => {
                      return await envVarSetValidator(form, envVars);
                    },
                  },
                ]}
              >
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <Form.Item key={field.key}>
                        <Form.Item
                          {...field}
                          validateTrigger={["onChange", "onBlur"]}
                          rules={[
                            {
                              required: true,
                              whitespace: true,
                              pattern: /^[\w-]+=.*$/,
                              message:
                                "环境变量必须为 KEY=VALUE 格式",
                            },
                          ]}
                          noStyle
                        >
                          <Input
                            placeholder="KEY=VALUE"
                            onBlur={() => form.validateFields()}
                            style={{ width: "90%" }}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          className="dynamic-delete-button"
                          onClick={() => remove(index)}
                          style={{ paddingLeft: "5px" }}
                        />
                      </Form.Item>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add("")}
                        style={{ width: "90%" }}
                        icon={<PlusOutlined />}
                      >
                        设置环境变量
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* Repo.flags */}
          <Form.Item label="命令参数">
            <Form.List name="flags">
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field, index) => (
                    <Form.Item required={false} key={field.key}>
                      <Form.Item
                        {...field}
                        validateTrigger={["onChange", "onBlur"]}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            pattern: /^\-\-?.*$/,
                            message:
                              "参数应为 CLI 参数格式，例如 --flag",
                          },
                        ]}
                        noStyle
                      >
                        <Input placeholder="--flag" style={{ width: "90%" }} />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(index)}
                        style={{ paddingLeft: "5px" }}
                      />
                    </Form.Item>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      style={{ width: "90%" }}
                      icon={<PlusOutlined />}
                    >
                      添加参数
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* Repo.prunePolicy */}
          <Form.Item
            label={
              <Tooltip
                title={
                  <span>
                    设置运行 Prune 操作的时间计划。更多信息请参考{" "}
                    <a
                      href="https://restic.readthedocs.io/en/latest/060_forget.html#customize-pruning" 
                      target="_blank"
                    >
                      restic 关于 Prune 操作的文档
                    </a>
                  </span>
                }
              >
                清理策略
              </Tooltip>
            }
          >
            <Form.Item
              name={["prunePolicy", "maxUnusedPercent"]}
              initialValue={10}
              required={false}
            >
              <InputPercent
                addonBefore={
                  <Tooltip title="Prune 后，仓库中最多保留的未使用空间百分比。数值高可以减少复制开销，但会占用更多存储空间">
                    <div style={{ width: "12" }}>最大未使用空间比例</div>
                  </Tooltip>
                }
              />
            </Form.Item>
            <ScheduleFormItem
              name={["prunePolicy", "schedule"]}
              defaults={ScheduleDefaultsInfrequent}
            />
          </Form.Item>

          {/* Repo.checkPolicy */}
          <Form.Item
            label={
              <Tooltip
                title={
                  <span>
                    设置运行 Check 操作的时间计划。Restic Check 会验证你的备份数据完整性。
                    可选地，你还可以配置为重新读取并哈希数据，这会消耗较多带宽，但能检测存储介质上的位腐烂或静默损坏。
                  </span>
                }
              >
                校验策略
              </Tooltip>
            }
          >
            <Form.Item
              name={["checkPolicy", "readDataSubsetPercent"]}
              initialValue={0}
              required={false}
            >
              <InputPercent
                addonBefore={
                  <Tooltip title="仓库中 pack 数据的读取百分比。数值越高越耗带宽（如 100% 表示每次校验都读取整个仓库）">
                    <div style={{ width: "12" }}>读取数据百分比</div>
                  </Tooltip>
                }
              />
            </Form.Item>
            <ScheduleFormItem
              name={["checkPolicy", "schedule"]}
              defaults={ScheduleDefaultsInfrequent}
            />
          </Form.Item>

          {/* Repo.commandPrefix */}
          {!isWindows && (
            <Form.Item
              label={
                <Tooltip
                  title={
                    <span>
                      备份操作的附加参数，比如设置 CPU 或 IO 优先级。
                    </span>
                  }
                >
                  命令修饰符
                </Tooltip>
              }
              colon={false}
            >
              <Row>
                <Col span={12} style={{ paddingLeft: "5px" }}>
                  <Tooltip
                    title={
                      <>
                        支持的 IO 优先级模式：
                        <ul>
                          <li>
                            IO_BEST_EFFORT_LOW - 使用低于默认的磁盘优先级
                          </li>
                          <li>
                            IO_BEST_EFFORT_HIGH - 使用高于默认的磁盘优先级
                          </li>
                          <li>
                            IO_IDLE - 只在磁盘空闲时运行（无其他任务排队）
                          </li>
                        </ul>
                      </>
                    }
                  >
                    IO 优先级：
                    <br />
                    <Form.Item
                      name={["commandPrefix", "ioNice"]}
                      required={false}
                    >
                      <Select
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="选择 IO 优先级"
                        options={CommandPrefix_IONiceLevelSchema.values.map(
                          (v) => ({
                            label: v.name,
                            value: v.name,
                          })
                        )}
                      />
                    </Form.Item>
                  </Tooltip>
                </Col>
                <Col span={12} style={{ paddingLeft: "5px" }}>
                  <Tooltip
                    title={
                      <>
                        支持的 CPU 优先级模式：
                        <ul>
                          <li>CPU_DEFAULT - 不改变优先级</li>
                          <li>
                            CPU_HIGH - 高于默认优先级（需要以 root 权限运行）
                          </li>
                          <li>CPU_LOW - 低于默认优先级</li>
                        </ul>
                      </>
                    }
                  >
                    CPU 优先级：
                    <br />
                    <Form.Item
                      name={["commandPrefix", "cpuNice"]}
                      required={false}
                    >
                      <Select
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="选择 CPU 优先级"
                        options={CommandPrefix_CPUNiceLevelSchema.values.map(
                          (v) => ({
                            label: v.name,
                            value: v.name,
                          })
                        )}
                      />
                    </Form.Item>
                  </Tooltip>
                </Col>
              </Row>
            </Form.Item>
          )}

          <Form.Item
            label={
              <Tooltip title="自动解锁会在 forget 和 prune 操作开始时自动移除锁文件。如果多个客户端共享同一个仓库，此功能不安全，默认关闭。">
                自动解锁
              </Tooltip>
            }
            name="autoUnlock"
            valuePropName="checked"
          >
            <Checkbox />
          </Form.Item>

          <Form.Item
            label={<Tooltip title={hooksListTooltipText}>钩子</Tooltip>}
          >
            <HooksFormList />
          </Form.Item>

          <Form.Item shouldUpdate label="预览">
            {() => (
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: "存储库配置 JSON 格式",
                    children: (
                      <Typography>
                        <pre>
                          {JSON.stringify(form.getFieldsValue(), undefined, 2)}
                        </pre>
                      </Typography>
                    ),
                  },
                ]}
              />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const expectedEnvVars: { [scheme: string]: string[][] } = {
  s3: [
    ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    ["AWS_SHARED_CREDENTIALS_FILE"],
  ],
  b2: [["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"]],
  azure: [
    ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"],
    ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_SAS"],
  ],
  gs: [
    ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_PROJECT_ID"],
    ["GOOGLE_ACCESS_TOKEN"],
  ],
};

const envVarSetValidator = (
  form: FormInstance<any>,
  envVars: string[]
) => {
  if (!envVars) {
    return Promise.resolve();
  }

  let uri = form.getFieldValue("uri");
  if (!uri) {
    return Promise.resolve();
  }

  const envVarNames = envVars.map((e) => {
    if (!e) {
      return "";
    }
    let idx = e.indexOf("=");
    if (idx === -1) {
      return "";
    }
    return e.substring(0, idx);
  });

  const password = form.getFieldValue("password");
  if (
    (!password || password.length === 0) &&
    !envVarNames.includes("RESTIC_PASSWORD") &&
    !envVarNames.includes("RESTIC_PASSWORD_COMMAND") &&
    !envVarNames.includes("RESTIC_PASSWORD_FILE")
  ) {
    return Promise.reject(
      new Error(
        "缺少存储库密码。请提供密码，或设置下列任意一个环境变量：RESTIC_PASSWORD、RESTIC_PASSWORD_COMMAND、RESTIC_PASSWORD_FILE。"
      )
    );
  }

  let schemeIdx = uri.indexOf(":");
  if (schemeIdx === -1) {
    return Promise.resolve();
  }

  let scheme = uri.substring(0, schemeIdx);
  return checkSchemeEnvVars(scheme, envVarNames);
};

const cryptoRandomPassword = (): string => {
  let vals = crypto.getRandomValues(new Uint8Array(64));
  return btoa(String.fromCharCode(...vals)).slice(0, 48);
};

const checkSchemeEnvVars = (
  scheme: string,
  envVarNames: string[]
): Promise<void> => {
  let expected = expectedEnvVars[scheme];
  if (!expected) {
    return Promise.resolve();
  }

  const missingVarsCollection: string[][] = [];
  for (let possibility of expected) {
    const missingVars = possibility.filter(
      (envVar) => !envVarNames.includes(envVar)
    );

    if (missingVars.length === 0) {
      return Promise.resolve();
    }

    if (missingVars.length < possibility.length) {
      missingVarsCollection.push(missingVars);
    }
  }

  if (!missingVarsCollection.length) {
    missingVarsCollection.push(...expected);
  }

  return Promise.reject(
    new Error(
      "缺少必要的环境变量：" +
        formatMissingEnvVars(missingVarsCollection) +
        "（适用于协议：" +
        scheme +
        "）"
    )
  );
};

const formatMissingEnvVars = (partialMatches: string[][]): string => {
  return partialMatches
    .map((x) => {
      if (x.length > 1) {
        return `[ ${x.join(", ")} ]`;
      }
      return x[0];
    })
    .join(" 或 ");
};

const InputPercent = ({ ...props }) => {
  return (
    <InputNumber
      step={1}
      min={0}
      max={100}
      precision={2}
      controls={false}
      suffix="%"
      {...props}
    />
  );
};