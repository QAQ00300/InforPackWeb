import { useNavigate } from 'react-router-dom';
import { Upload, FileText, ArrowRight, FileSearch } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
            <FileSearch className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Parser 系统</h1>
          <p className="text-gray-500">提单文件解析与审查系统</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-8 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/')}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">文件上传页面</h2>
                <p className="text-gray-500 text-sm mb-4">
                  上传提单文件，填写 SO NO，系统自动校验 SO NO 是否重复。
                  确认上传后，系统将发送文件至解析处进行解析。
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <span>进入上传页面</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-8 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/review/test')}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">审查确认页面</h2>
                <p className="text-gray-500 text-sm mb-4">
                  查看解析后的提单数据，核实发货人、收货人、货物信息等内容，
                  修改错误后确认信息，数据将转发至下游系统。
                </p>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <span>进入审查页面</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">流程说明</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">1</div>
              <span className="text-gray-600">上传文件</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-sm font-bold">2</div>
              <span className="text-gray-600">填写 SO NO</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold">3</div>
              <span className="text-gray-600">确认上传</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">4</div>
              <span className="text-gray-600">系统解析</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">5</div>
              <span className="text-gray-600">审查确认</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}